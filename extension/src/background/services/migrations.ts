/**
 * Local schema migration runner. Runs on background service worker wake
 * and advances `schemaVersionItem` through a linear sequence of migrations.
 *
 * Current schema version: 1 (initial baseline — all pre-v1.0 data is
 * treated as v0 and gets a no-op "adopt current shape" migration).
 *
 * When you add a new migration:
 *   1. Increment CURRENT_SCHEMA_VERSION.
 *   2. Push an entry to MIGRATIONS with { from, to, name, run }.
 *   3. `run` must be idempotent — service workers can wake mid-migration.
 *
 * Keep migrations cheap and synchronous-ish; a slow migration blocks the
 * first tree read on every extension update.
 */

import { storage } from "wxt/utils/storage";
import { createLogger } from "@shared/lib/logger.js";
import { captureError } from "@shared/lib/observability.js";

const log = createLogger("migrations");

export const CURRENT_SCHEMA_VERSION = 1 as const;

const schemaVersionItem = storage.defineItem<number>("local:trail_schema_version", {
  fallback: 0,
});

type Migration = {
  from: number;
  to: number;
  name: string;
  run: () => Promise<void>;
};

const MIGRATIONS: Migration[] = [
  {
    from: 0,
    to: 1,
    name: "baseline",
    async run() {
      // No-op: adopts whatever shape pre-v1.0 installs have. Future
      // migrations will target from: 1.
    },
  },
];

// Index by `from` so the runner is insensitive to ordering in the array.
function migrationFrom(v: number): Migration | undefined {
  return MIGRATIONS.find((m) => m.from === v);
}

// Singleflight: concurrent callers share the same in-flight migration
// and see it either succeed once or reject once. Cleared only on
// rejection so a successful run is terminal until the next SW wake.
let runningMigrations: Promise<void> | null = null;

export async function runMigrations(): Promise<void> {
  if (runningMigrations) return runningMigrations;

  runningMigrations = (async () => {
    let current = await schemaVersionItem.getValue();
    if (current >= CURRENT_SCHEMA_VERSION) return;

    log.info("migrations: starting", { from: current, to: CURRENT_SCHEMA_VERSION });

    // while-loop indexed by from-version: future out-of-order appends
    // can't cause silent skips the way the filtered single-pass did.
    while (current < CURRENT_SCHEMA_VERSION) {
      const m = migrationFrom(current);
      if (!m) {
        const error = new Error(
          `No migration registered from schema version ${current} to ${CURRENT_SCHEMA_VERSION}`,
        );
        captureError(error, { kind: "migration_gap", from: current });
        log.error("migration gap", { from: current });
        throw error;
      }
      try {
        await m.run();
      } catch (error) {
        captureError(error, { kind: "migration_failed", name: m.name });
        log.error("migration failed", {
          name: m.name,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      current = m.to;
      await schemaVersionItem.setValue(current);
      log.info("migrations: applied", { name: m.name, at: current });
    }
  })().catch((error) => {
    // Reset singleflight on failure so a retry (e.g., onInstalled)
    // can try again. Don't swallow — re-throw so callers see it.
    runningMigrations = null;
    throw error;
  });

  return runningMigrations;
}
