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
import {
  activeTreeItem,
  archiveIndexItem,
  undoHistoryItem,
  layoutPositionsCacheItem,
} from "../../shared/config/storage-items.js";
import { isTreeStub } from "@shared/types/tree.js";
import { uuidv7 } from "@shared/lib/uuid.js";

const log = createLogger("migrations");

export const CURRENT_SCHEMA_VERSION = 2 as const;

/**
 * Walk a raw NavigationTreeJSON-shaped object and REPLACE every `id`
 * with a fresh uuidv7. Tree structure (parent/child layout via the
 * children arrays) is preserved; only the identity tokens change.
 *
 * An old→new id map is threaded through the walk so the tree's
 * `currentNodeId` pointer can be rewritten to the new id of the same
 * logical node.
 */
function rementIdsInNodeJSON(node: unknown, idMap: Map<string, string>): void {
  if (!node || typeof node !== "object") return;
  const n = node as { id?: unknown; children?: unknown[] };
  if (n.id !== undefined && n.id !== null) {
    const oldId = String(n.id);
    const newId = uuidv7();
    idMap.set(oldId, newId);
    n.id = newId;
  }
  if (Array.isArray(n.children)) {
    for (const child of n.children) rementIdsInNodeJSON(child, idMap);
  }
}

function rementIdsInTreeJSON(json: unknown): unknown {
  if (!json || typeof json !== "object") return json;
  const t = json as { root?: unknown; currentNodeId?: unknown };
  const idMap = new Map<string, string>();
  if (t.root) rementIdsInNodeJSON(t.root, idMap);
  if (t.currentNodeId !== undefined && t.currentNodeId !== null) {
    const oldId = String(t.currentNodeId);
    t.currentNodeId = idMap.get(oldId) ?? null;
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
    name: "rement_node_ids_uuidv7",
    async run() {
      // Re-mint every NodeId as a fresh uuidv7. Tree structure is
      // preserved (parent/child layout is encoded in the children
      // arrays, which don't reference ids externally — only the
      // `currentNodeId` pointer does, and it's rewritten via the
      // old→new map in rementIdsInTreeJSON).

      // 1. Active tree
      const activeTree = await activeTreeItem.getValue();
      if (activeTree) {
        rementIdsInTreeJSON(activeTree);
        await activeTreeItem.setValue(activeTree);
      }

      // 2. Archive blobs (one per non-stub archive). Each archive is
      //    an independent id-space; we re-mint each tree separately.
      //    Stubs hold remote-only references — no local node data.
      const archives = await archiveIndexItem.getValue();
      if (archives.some((e) => !isTreeStub(e))) {
        const { treeStorage } = await import("./tree-storage.js");
        for (const entry of archives) {
          if (isTreeStub(entry)) continue;
          try {
            const tree = await treeStorage.getArchiveTree(entry.id);
            if (!tree) continue;
            rementIdsInTreeJSON(tree);
            await treeStorage.saveArchiveTree(entry.id, tree);
          } catch (error) {
            log.warn("rement_node_ids_uuidv7: failed to rewrite archive blob", {
              id: entry.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // 3. Clear persisted state that references old node ids:
      //    - Undo history snapshots contain pre-migration tree JSONs.
      //      Applying them now would resurrect stale ids. Drop.
      //    - Layout positions cache is keyed by nodeId. Drop — will
      //      recompute on next layout pass.
      //    - lastNodeByTab (session storage, used by opener-based
      //      parent inference) holds pre-migration node ids. Clear
      //      so tabs re-register with fresh ids via syncOpenTabs.
      await undoHistoryItem.removeValue().catch((error) => {
        log.warn("rement_node_ids_uuidv7: undo history clear failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      await layoutPositionsCacheItem.removeValue().catch((error) => {
        log.warn("rement_node_ids_uuidv7: layout cache clear failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      await storage.removeItem("session:trail_last_node_by_tab").catch((error) => {
        log.warn("rement_node_ids_uuidv7: session lastNodeByTab clear failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });

      // Post-condition: every persisted node id must be a uuidv7 string.
      // A quick shape check: length 36 with hyphens at the right spots.
      const verify = await activeTreeItem.getValue();
      if (verify && verify.root) {
        let failed: string | null = null;
        const uuidv7Re = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const walk = (n: unknown): void => {
          if (failed || !n || typeof n !== "object") return;
          const node = n as { id?: unknown; children?: unknown[] };
          if (typeof node.id !== "string" || !uuidv7Re.test(node.id)) {
            failed = `invalid id: ${String(node.id)}`;
            return;
          }
          if (Array.isArray(node.children)) for (const c of node.children) walk(c);
        };
        walk(verify.root);
        if (failed) {
          throw new Error(`rement_node_ids_uuidv7: post-verify failed — ${failed}`);
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
