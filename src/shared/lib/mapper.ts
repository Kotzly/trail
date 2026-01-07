import { TreeEntry, TreeNodeJSON } from "../types/node";
import { TreeNode } from "../../background/state/treenode";

export class TreeNodeMapper {
    static fromJSON(json: TreeNodeJSON, parent: TreeNode | null = null): TreeNode {
      const node = new TreeNode({
        url: json.url,
        title: json.title,        // if your TreeNode allows optional title, see defaults below
        favicon: json.favicon,
      } as TreeEntry);
  
      // Better: avoid `(any)` by letting TreeNode accept id in ctor or a factory
      (node as any).id = json.id;
  
      node.timestamp = json.timestamp;
      node.parent = parent;
      node.collapsed = json.collapsed ?? false;
      node.pinned = json.pinned ?? false;
      node.tags = [...(json.tags ?? [])];
  
      node.children = (json.children ?? []).map(child => TreeNodeMapper.fromJSON(child, node));
      return node;
    }
  
    static toJSON(node: TreeNode): TreeNodeJSON {
      return {
        id: node.id,
        url: node.url,
        title: node.title ?? '',          // ensure required fields exist
        favicon: node.favicon,
        timestamp: node.timestamp,
  
        pinned: node.pinned ?? false,
        collapsed: node.collapsed ?? false,
        tags: [...(node.tags ?? [])],
  
        children: node.children.map(TreeNodeMapper.toJSON),
      } as TreeNodeJSON;
    }
  
    // Boundary helpers for optional root
    static rootFromJSON(json: TreeNodeJSON | null): TreeNode | null {
      return json ? TreeNodeMapper.fromJSON(json, null) : null;
    }
  
    static rootToJSON(node: TreeNode | null): TreeNodeJSON | null {
      return node ? TreeNodeMapper.toJSON(node) : null;
    }
  }
  