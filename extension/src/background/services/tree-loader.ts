/**
 * Unified tree loading from local sources.
 *
 * Single entry point for all tree loading.
 */

import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import { type TreeRecord } from "@shared/types/tree.js";
import { treeStorage } from "./tree-storage.js";

/**
 * Load a tree by ID from local sources.
 * Returns null if the tree doesn't exist locally.
 */
export async function loadTree(treeId: string): Promise<TreeRecord | null> {
  // 1. Check if it's the active tree
  const activeMeta = await treeStorage.getActiveMeta();
  if (activeMeta.id === treeId) {
    const tree = await treeStorage.getOrCreateTree();
    const treeJSON = NavigationTreeMapper.toJSON(tree);
    const savedAt = await treeStorage.getActiveSavedAt();
    return {
      ...activeMeta,
      nodeCount: tree.size(),
      savedAt,
      tree: treeJSON,
    };
  }

  // 2. Check archive blob (local compressed storage)
  const fullRecord = await treeStorage.getFullArchiveRecord(treeId);
  if (fullRecord) return fullRecord;

  return null;
}
