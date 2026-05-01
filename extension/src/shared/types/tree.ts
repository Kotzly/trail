import { type NodeId, type Url, type Title, type FaviconUrl } from "./ids.js";
import { type NavigationNodeJSON } from "./node.js";

export type NavigationOptions = {
  backOnRevisit?: boolean;
};

export const DefaultNavigationOptions: NavigationOptions = {
  backOnRevisit: true,
} as const;

export interface NavigationTreeJSON {
  root: NavigationNodeJSON | null;
  currentNodeId: NodeId | null;
  nodeCount: number;
}

export type TreeLabelSource = "user" | "auto" | "system";

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
  /**
   * Last time the user opened/stashed/materialized this tree locally.
   * Optional for backwards compatibility — entries written before this
   * field existed will be missing it; retention sort falls back to
   * `savedAt` in that case.
   */
  lastOpenedAt?: number;
};

export type TreeRecord = TreeSummary & {
  tree: NavigationTreeJSON;
};

/**
 * A stub entry in the tree index: the tree payload is NOT stored locally,
 * it exists only on the server.  Opening a stub triggers a cloud fetch.
 */
export type TreeStub = TreeSummary & { stub: true };

/**
 * Each entry in the tree index is either a full summary (with a
 * corresponding compressed blob in `trail_ar_{id}`) or a stub.
 */
export type TreeIndexEntry = TreeSummary | TreeStub;

export function isTreeStub(entry: TreeIndexEntry): entry is TreeStub {
  return "stub" in entry && entry.stub === true;
}

export { isNavigationTreeJSON } from "../schemas/node.js";
