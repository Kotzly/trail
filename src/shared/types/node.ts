import { TreeNode } from "../../background/state/tree-node.js";
import type { NodeId, Timestamp, Title, Url, FaviconUrl, Tag } from "./ids.js"


export type NodeData = {
    readonly url: Url;

    title: Title;
    favicon?: FaviconUrl;
    
    pinned: boolean;
    tags: Tag[];
    collapsed: boolean;
}

export type NodeDataPatch = Partial<Omit<NodeData, "url">>;

export function updateNodeData(
  old: NodeData,
  patch: NodeDataPatch
): NodeData {
  return {
    ...old,
    ...patch,

    favicon:
      patch.favicon !== undefined ? patch.favicon : old.favicon,

    tags: patch.tags ? [...patch.tags] : old.tags,
  } as NodeData;
}


export type TreeNodeJSON<T> = {
    id: NodeId;
    timestamp: Timestamp;
    
    data: T;

    children: TreeNodeJSON<T>[];
}

export type NavigationNode = TreeNode<NodeData>;

export type NavigationNodeJSON = TreeNodeJSON<NodeData>;