/**
 * Unified tree loading entry point.
 *
 * Resolution order:
 *   1. Active tree (in-memory / chrome.storage)
 *   2. Local archive blob (compressed, chrome.storage)
 *   3. Remote Supabase payload (only when signed in; materializes to
 *      local archive for subsequent loads)
 */

import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import { isTreeStub, type TreeRecord } from "@shared/types/tree.js";
import { treeStorage } from "./tree-storage.js";

export async function loadTree(treeId: string): Promise<TreeRecord | null> {
  // 1. Active tree — the live in-memory copy.
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

  // 2. Archived locally.
  const fullRecord = await treeStorage.getFullArchiveRecord(treeId);
  if (fullRecord) return fullRecord;

  // 3. Stub on server only — try to fetch + materialize.
  const index = await treeStorage.getArchiveIndex();
  const entry = index.find((e) => e.id === treeId);
  if (!entry || !isTreeStub(entry)) return null;

  // Lazy import so the sync module isn't pulled in for purely-local flows.
  const { fetchRemoteTreePayload } = await import("../sync/sync-engine.js");
  const payload = await fetchRemoteTreePayload(treeId);
  if (!payload) return null;

  return {
    id: entry.id,
    label: entry.label,
    labelSource: entry.labelSource,
    labelUpdatedAt: entry.labelUpdatedAt,
    createdAt: entry.createdAt,
    savedAt: entry.savedAt,
    nodeCount: entry.nodeCount,
    ...(entry.rootUrl ? { rootUrl: entry.rootUrl } : {}),
    ...(entry.rootTitle ? { rootTitle: entry.rootTitle } : {}),
    ...(entry.rootFavicon ? { rootFavicon: entry.rootFavicon } : {}),
    tree: payload,
  };
}
