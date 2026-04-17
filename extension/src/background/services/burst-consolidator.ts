/**
 * Burst consolidation consumer. Listens for burst-step / burst-seal
 * classifications from the nav-pattern-tracker, accumulates the
 * recent sibling nodeIds per tab, and on seal wraps them in a
 * burst container via NavigationTree.consolidateBurst.
 *
 * Lives as a per-tab Map. State is transient (lost on SW suspend),
 * which is OK because the tracker itself persists its streak and
 * will re-emit burst-step events once it repopulates; we just won't
 * consolidate a burst that started right before suspend.
 */

import type { NodeId, TabId } from "@shared/types/ids.js";
import { treeStorage, withTreeLock } from "./tree-storage.js";
import { settingsManager } from "./settings.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("burst-consolidator");

type PendingBurst = {
  itemIds: NodeId[];
  urlTemplate: string;
  startedAt: number;
};

const pending = new Map<TabId, PendingBurst>();

/**
 * Accumulate a burst-step: record the item's node id so when the
 * burst seals, we know which nodes to wrap.
 */
export function onBurstStep(tabId: TabId, nodeId: NodeId, shape: string, timestamp: number): void {
  const existing = pending.get(tabId);
  if (existing && existing.urlTemplate === shape) {
    if (!existing.itemIds.includes(nodeId)) existing.itemIds.push(nodeId);
    return;
  }
  // New burst pending (or template changed).
  pending.set(tabId, { itemIds: [nodeId], urlTemplate: shape, startedAt: timestamp });
}

/**
 * Seal: wrap pending items in a burst container if there are enough
 * (≥ settings.cleanup.burst.minItems). Resets pending state for the
 * tab.
 */
export async function onBurstSeal(tabId: TabId): Promise<void> {
  const p = pending.get(tabId);
  pending.delete(tabId);
  if (!p) return;

  const cleanup = settingsManager.get().cleanup;
  if (!cleanup?.burst?.enabled) return;
  const minItems = cleanup.burst.minItems ?? 5;
  if (p.itemIds.length < minItems) return;

  try {
    await withTreeLock(async () => {
      const tree = await treeStorage.getOrCreateTree();
      // Filter out ids whose nodes vanished in the interim (glance
      // prune or user-delete between the step and the seal).
      const live = p.itemIds.filter((id) => tree.findNodeById(id) !== null);
      if (live.length < minItems) return;
      const container = tree.consolidateBurst(live, {
        urlTemplate: p.urlTemplate,
        autoLabel: `${p.urlTemplate} · ${live.length} items`,
      });
      if (container) {
        treeStorage.cacheTree(tree);
      }
    });
  } catch (error) {
    log.warn("consolidateBurst failed", {
      tabId: String(tabId),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Drop pending state for a closed tab. */
export function onTabClosed(tabId: TabId): void {
  pending.delete(tabId);
}
