/**
 * Persists open-tab URLs per tree so they can be restored on tree switch.
 *
 * Storage key: `trail_tree_open_tabs`
 * Shape: Record<treeId, string[]>  (treeId → URL list)
 */

const STORAGE_KEY = 'trail_tree_open_tabs' as const;
const storageArea = chrome.storage.local;

type OpenTabsMap = Record<string, string[]>;

async function readMap(): Promise<OpenTabsMap> {
  try {
    const result = await storageArea.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as OpenTabsMap;
    }
  } catch (error) {
    console.error('TabRestorationService: failed to read open-tabs map', error);
  }
  return {};
}

async function writeMap(map: OpenTabsMap): Promise<void> {
  try {
    await storageArea.set({ [STORAGE_KEY]: map });
  } catch (error) {
    console.error('TabRestorationService: failed to write open-tabs map', error);
  }
}

/** Save the list of open URLs for a tree. */
export async function saveOpenTabs(treeId: string, urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  const map = await readMap();
  map[treeId] = urls;
  await writeMap(map);
}

/** Retrieve (and remove) saved URLs for a tree. Returns null if none exist. */
export async function getOpenTabs(treeId: string): Promise<string[] | null> {
  const map = await readMap();
  const urls = map[treeId];
  if (!urls || urls.length === 0) return null;
  delete map[treeId];
  await writeMap(map);
  return urls;
}

/** Remove saved URLs for a tree (e.g. on tree deletion). */
export async function clearOpenTabs(treeId: string): Promise<void> {
  const map = await readMap();
  if (!(treeId in map)) return;
  delete map[treeId];
  await writeMap(map);
}
