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

import { createLogger } from "@shared/lib/logger.js";
import { captureError } from "@shared/lib/observability.js";
import { storage } from "wxt/utils/storage";
import { activeTreeItem, archiveIndexItem } from "../../shared/config/storage-items.js";
import { isTreeStub } from "@shared/types/tree.js";

const log = createLogger("migrations");

export const CURRENT_SCHEMA_VERSION = 2 as const;

/**
 * Walk a raw NavigationTreeJSON-shaped object and coerce every `id` to
 * a string. Idempotent — running on already-migrated data is a no-op.
 *
 * This is purely data-shape work; the runtime NodeId type becomes a
 * `Brand<string, "NodeId">` in Phase 1. We do the stringify here so
 * downstream code never sees a mixed-key `Map<NodeId, ...>`.
 */
function stringifyIdsInNodeJSON(node: unknown): void {
  if (!node || typeof node !== "object") return;
  const n = node as { id?: unknown; children?: unknown[] };
  if (n.id !== undefined && n.id !== null && typeof n.id !== "string") {
    n.id = String(n.id);
  }
  if (Array.isArray(n.children)) {
    for (const child of n.children) stringifyIdsInNodeJSON(child);
  }
}

function stringifyIdsInTreeJSON(json: unknown): unknown {
  if (!json || typeof json !== "object") return json;
  const t = json as { root?: unknown; currentNodeId?: unknown };
  if (t.root) stringifyIdsInNodeJSON(t.root);
  if (
    t.currentNodeId !== undefined &&
    t.currentNodeId !== null &&
    typeof t.currentNodeId !== "string"
  ) {
    t.currentNodeId = String(t.currentNodeId);
  }
  return json;
}

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
  {
    from: 1,
    to: 2,
    name: "stringify_node_ids",
    async run() {
      // Convert numeric NodeIds in all persisted trees to strings.
      // Safe to run concurrently (single-flight guard in runMigrations)
      // and idempotent (already-string ids are left alone).

      // 1. Active tree
      const activeTree = await activeTreeItem.getValue();
      if (activeTree) {
        stringifyIdsInTreeJSON(activeTree);
        await activeTreeItem.setValue(activeTree);
      }

      // 2. Archive blobs (one per non-stub archive). Stubs hold only
      //    remote references; no local node data to rewrite. We go
      //    through treeStorage.getArchiveTree/saveArchiveTree so the
      //    compressed/base64 round-trip matches what the rest of the
      //    extension expects; dynamic import keeps migrations.ts from
      //    eagerly importing the storage service (avoiding a cycle).
      const archives = await archiveIndexItem.getValue();
      if (archives.some((e) => !isTreeStub(e))) {
        const { treeStorage } = await import("./tree-storage.js");
        for (const entry of archives) {
          if (isTreeStub(entry)) continue;
          try {
            const tree = await treeStorage.getArchiveTree(entry.id);
            if (!tree) continue;
            stringifyIdsInTreeJSON(tree);
            await treeStorage.saveArchiveTree(entry.id, tree);
          } catch (error) {
            log.warn("stringify_node_ids: failed to rewrite archive blob", {
              id: entry.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Post-condition assertion: re-read the active tree and confirm
      // no numeric ids slipped through. Throws if migration failed
      // silently.
      const verify = await activeTreeItem.getValue();
      if (verify && verify.root) {
        let failed = false;
        const walk = (n: unknown): void => {
          if (failed || !n || typeof n !== "object") return;
          const node = n as { id?: unknown; children?: unknown[] };
          if (typeof node.id !== "string") {
            failed = true;
            return;
          }
          if (Array.isArray(node.children)) for (const c of node.children) walk(c);
        };
        walk(verify.root);
        if (failed) {
          throw new Error("stringify_node_ids: post-verify found non-string node id");
        }
      }
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
