/**
 * Persists open-tab URLs per tree so they can be restored on tree switch.
 *
 * Storage key: `trail_tree_open_tabs`
 * Shape: Record<treeId, string[]>  (treeId → URL list)
 */

import { openTabsItem } from '../../shared/config/storage-items.js';

/** Save the list of open URLs for a tree. */
export async function saveOpenTabs(treeId: string, urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const map = await openTabsItem.getValue();
  map[treeId] = urls;
  await openTabsItem.setValue(map);
}

/** Retrieve (and remove) saved URLs for a tree. Returns null if none exist. */
export async function getOpenTabs(treeId: string): Promise<string[] | null> {
  const map = await openTabsItem.getValue();
  const urls = map[treeId];
  if (!urls || urls.length === 0) return null;
  delete map[treeId];
  await openTabsItem.setValue(map);
  return urls;
}

/** Remove saved URLs for a tree (e.g. on tree deletion). */
export async function clearOpenTabs(treeId: string): Promise<void> {
  const map = await openTabsItem.getValue();
  if (!(treeId in map)) return;
  delete map[treeId];
  await openTabsItem.setValue(map);
}
