import { TreeEntry, TreeNode, TreeNodeJSON } from "./node";
import { NodeId, Tag } from "./ids";

export class TreeNodeMapper {
    static fromJSON(
        json: TreeNodeJSON,
        parent?: TreeNode,
        allocateId: (id: NodeId) => NodeId = id => id as NodeId
    ): TreeNode {
        const node = new TreeNode(
            allocateId(json.id),
            {
                url: json.url,
                title: json.title,
                favicon: json.favicon
            } as TreeEntry,
            json.timestamp
        )
        if (parent) {
            node.parent = parent;
        }
        node.collapsed = json.collapsed;
        node.pinned = json.pinned;
        node.tags = json.tags;

        const children = Array.isArray(json.children) ? json.children : [];
        node.children = children.map(child => TreeNodeMapper.fromJSON(child, node, allocateId));
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
          tags: node.tags,
          children: node.children.map(TreeNodeMapper.toJSON)
        } as TreeNodeJSON;
      }
}