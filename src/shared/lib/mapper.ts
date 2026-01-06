import { TreeEntry, TreeNode, TreeNodeJSON } from "../types/node";

export class TreeNodeMapper {
    static fromJSON(
        json: TreeNodeJSON,
        parent: TreeNode | null = null,
    ): TreeNode {
        const node = new TreeNode(
            { url: json.url, title: json.title, favicon: json.favicon } as TreeEntry,
        );
        (node as any).id = json.id;
        node.timestamp = json.timestamp;
        node.parent = parent;
        node.collapsed = json.collapsed;
        node.pinned = json.pinned;
        node.tags = [...json.tags];

        node.children = json.children.map(child => TreeNodeMapper.fromJSON(child, node));
        return node;
    }

    static toJSON(node: TreeNode): TreeNodeJSON {
        return {
          id: node.id,
          url: node.url,
          title: node.title,
          favicon: node.favicon,
          timestamp: node.timestamp,
          pinned: node.pinned,
          collapsed: node.collapsed,
          tags: [...node.tags],
          children: node.children.map(TreeNodeMapper.toJSON)
        } as TreeNodeJSON;
      }
}