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

export async function runMigrations(): Promise<void> {
  let current = await schemaVersionItem.getValue();
  if (current >= CURRENT_SCHEMA_VERSION) return;

  log.info("migrations: starting", { from: current, to: CURRENT_SCHEMA_VERSION });

  for (const m of MIGRATIONS) {
    if (m.from !== current) continue;
    try {
      await m.run();
    } catch (error) {
      captureError(error, { kind: "migration_failed", name: m.name });
      log.error("migration failed", {
        name: m.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return; // stop on first failure
    }
    current = m.to;
    await schemaVersionItem.setValue(current);
    log.info("migrations: applied", { name: m.name, at: current });
  }
}
