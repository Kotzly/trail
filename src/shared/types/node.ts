import { TreeNode } from "../../background/state/tree-node.js";
import type { NodeId, Timestamp, Title, Url, FaviconUrl, Tag } from "./ids.js"


export type NodeData = {
    readonly url: Url;

    title: Title;
    favicon?: FaviconUrl;
    pinned: boolean;
    tags: Tag[];

}

export type NodeDataPatch = Partial<Omit<NodeData, "url">>;
export type NodeMetaPatch = Pick<NodeData, "title" | "favicon">;

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

export function updateNodeMeta(
  old: NodeData,
  patch: NodeMetaPatch
): NodeData {
  return {
    ...old,
    title: patch.title ?? old.title,
    favicon: patch.favicon !== undefined ? patch.favicon : old.favicon,
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
