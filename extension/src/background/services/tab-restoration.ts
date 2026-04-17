/**
 * Persists open-tab URLs per tree so they can be restored on tree switch.
 *
 * Storage key: `trail_tree_open_tabs`
 * Shape: Record<treeId, string[]>  (treeId → URL list)
 */

import { openTabsItem } from "@shared/config/storage-items.js";

/** Save the list of open URLs for a tree. */
export async function saveOpenTabs(treeId: string, urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const map = await openTabsItem.getValue();
  map[treeId] = urls;
  await openTabsItem.setValue(map);
}

/**
 * Peek at saved URLs for a tree without deleting them. The caller is
 * responsible for calling consumeOpenTabs() after every URL has been
 * successfully restored (#80 — non-destructive read).
 *
 * Returns null when no URLs exist.
 */
export async function getOpenTabs(treeId: string): Promise<string[] | null> {
  const map = await openTabsItem.getValue();
  const urls = map[treeId];
  if (!urls || urls.length === 0) return null;
  return urls;
}

/**
 * Delete saved URLs for a tree once the caller has confirmed they
 * were fully restored. Split from getOpenTabs so partial failures
 * (service worker killed mid-restore, tabs.create throws on some
 * URLs) preserve the pending list for next attempt instead of
 * silently discarding it.
 */
export async function consumeOpenTabs(treeId: string): Promise<void> {
  const map = await openTabsItem.getValue();
  if (!(treeId in map)) return;
  delete map[treeId];
  await openTabsItem.setValue(map);
}

/** Remove saved URLs for a tree (e.g. on tree deletion). */
export async function clearOpenTabs(treeId: string): Promise<void> {
  const map = await openTabsItem.getValue();
  if (!(treeId in map)) return;
  delete map[treeId];
  await openTabsItem.setValue(map);
}
