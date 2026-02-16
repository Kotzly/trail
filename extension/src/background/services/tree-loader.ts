/**
 * Unified tree loading with fallback chain:
 *   active tree → archive blob → cloud GET
 *
 * Single entry point for all tree loading. Replaces:
 *   - ensureTreeLoaded() from tree-storage
 *   - fetchTrailFromCloud() from cloud-fetch
 *   - inline loading in editor-handlers
 */

import { NavigationTreeMapper } from '../../shared/lib/mapper.js';
import { isTreeStub } from '../../shared/types/tree.js';
import type { TreeRecord } from '../../shared/types/tree.js';
import type { Url, Title, FaviconUrl } from '../../shared/types/ids.js';
import { treeStorage } from './tree-storage.js';
import { syncApi, SyncApiError } from './sync/api.js';
import type { PullTreeResponse } from './sync/api.js';

/**
 * Load a tree by ID, trying local sources first then falling back to cloud.
 * Returns null if the tree doesn't exist anywhere.
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

  // 3. Check if it's in the index but has no blob (stub or missing blob)
  const index = await treeStorage.getArchiveIndex();
  const entry = index.find((e) => e.id === treeId);

  if (entry) {
    const cloudRecord = await fetchFromCloud(treeId);
    if (cloudRecord) {
      await treeStorage.saveArchiveTree(treeId, cloudRecord.tree);
      if (isTreeStub(entry)) {
        await treeStorage.unstubArchiveEntry(treeId);
      }
      return {
        ...entry,
        nodeCount: cloudRecord.nodeCount,
        savedAt: cloudRecord.savedAt,
        tree: cloudRecord.tree,
      };
    }
  }

  // 4. Not in local index — try direct cloud fetch
  return fetchFromCloud(treeId);
}

/**
 * Fetch a tree from the cloud API and return as a TreeRecord.
 * Returns null on any error.
 */
async function fetchFromCloud(treeId: string): Promise<TreeRecord | null> {
  try {
    const response = await syncApi.pullTree(treeId);
    return remoteToTreeRecord(response);
  } catch (error) {
    if (error instanceof SyncApiError && error.kind === 'not_found') {
      return null;
    }
    if (error instanceof SyncApiError && error.kind === 'unauthorized') {
      return null;
    }
    console.warn(`TreeLoader: failed to fetch tree ${treeId} from cloud`, error);
    return null;
  }
}

function remoteToTreeRecord(remote: PullTreeResponse): TreeRecord {
  const record: TreeRecord = {
    id: remote.id,
    label: remote.label,
    labelSource: remote.labelSource,
    labelUpdatedAt: Date.parse(remote.labelUpdatedAt),
    createdAt: Date.parse(remote.createdAt),
    nodeCount: remote.nodeCount,
    savedAt: Date.parse(remote.savedAt),
    tree: remote.payload,
  };
  if (remote.rootUrl) record.rootUrl = remote.rootUrl as Url;
  if (remote.rootTitle) record.rootTitle = remote.rootTitle as Title;
  if (remote.rootFavicon) record.rootFavicon = remote.rootFavicon as FaviconUrl;
  return record;
}
