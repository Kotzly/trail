import { NodeId, Url, Title, FaviconUrl } from "./ids.js";
import { NavigationNodeJSON, TreeNodeJSON } from "./node.js";

export type NavigationOptions = {
    backOnRevisit?: boolean;
}

export const DefaultNavigationOptions: NavigationOptions = {
    backOnRevisit: true,
} as const;

export interface NavigationTreeJSON {
    root: NavigationNodeJSON | null;
    currentNodeId: NodeId | null;
    nodeCount: number;
}

export type TreeLabelSource = 'user' | 'auto' | 'system';

export type TreeMeta = {
    id: string;
    label: string;
    labelSource: TreeLabelSource;
    labelUpdatedAt: number;
    createdAt: number;
};

export type TreeSummary = TreeMeta & {
    nodeCount: number;
    savedAt: number;
    rootUrl?: Url;
    rootTitle?: Title;
    rootFavicon?: FaviconUrl;
};

export type TreeRecord = TreeSummary & {
    tree: NavigationTreeJSON;
};

/**
 * A stub entry in the archive index: the tree payload is NOT stored locally,
 * it exists only on the server.  Opening a stub triggers a cloud fetch.
 */
export type TreeStub = TreeSummary & { stub: true };

/**
 * Each entry in the archive index is either a full summary (with a
 * corresponding compressed blob in `trail_ar_{id}`) or a stub.
 */
export type ArchiveIndexEntry = TreeSummary | TreeStub;

export function isTreeStub(entry: ArchiveIndexEntry): entry is TreeStub {
  return 'stub' in entry && entry.stub === true;
}

export function isNavigationTreeJSON(value: unknown): value is NavigationTreeJSON {
  if (!value || typeof value !== 'object') return false;
  if (!('root' in value)) return false;
  const v = value as Record<string, unknown>;
  if (!(v.currentNodeId === null || typeof v.currentNodeId === 'number')) return false;
  if (!Number.isFinite(v.nodeCount)) return false;
  return true;
}
