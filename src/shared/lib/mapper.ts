import type { NavigationNode, NavigationNodeJSON, NodeData } from "../types/node.js";
import { TreeNode } from "../../background/state/tree-node.js";
import { NavigationTreeJSON } from "../types/tree.js";
import { NavigationTree } from "../../background/state/nav-tree.js";
import { defaultSettings } from "../../background/services/settings.js";

export class TreeNodeMapper {
    private static normalizeNodeData(
      json: NavigationNodeJSON
    ): NodeData {
      const raw = (json as Partial<NavigationNodeJSON> & { data?: Partial<NodeData> }).data ?? (json as Partial<NodeData>);

      const url = typeof raw?.url === "string" ? raw.url : "";
      const title = typeof raw?.title === "string" ? raw.title : "";
      const favicon = typeof raw?.favicon === "string" ? raw.favicon : undefined;
      const pinned = Boolean(raw?.pinned);
      const tags = Array.isArray(raw?.tags) ? raw.tags.filter((tag) => typeof tag === "string") : [];
      const rawLayout = (raw as Partial<NodeData>).layout as Partial<NodeData['layout']> | undefined;
      const offsetX = typeof rawLayout?.offsetX === "number" ? rawLayout.offsetX : 0;
      const offsetY = typeof rawLayout?.offsetY === "number" ? rawLayout.offsetY : 0;
      const layout =
        typeof rawLayout?.offsetX === "number" || typeof rawLayout?.offsetY === "number"
          ? { offsetX, offsetY }
          : undefined;

      return {
        url: url as NodeData["url"],
        title: title as NodeData["title"],
        favicon: favicon as NodeData["favicon"],
        pinned,
        tags: tags as NodeData["tags"],
        layout,
      } as NodeData;
    }

    static fromJSON(json: NavigationNodeJSON, parent?: NavigationNode): NavigationNode {
      const data = TreeNodeMapper.normalizeNodeData(json);
      const node = new TreeNode(data, parent, json.id);
  
      node.getChildren().push(...(json.children ?? []).map(child => TreeNodeMapper.fromJSON(child, node)));
      return node;
    }
  
    static toJSON(node: NavigationNode): NavigationNodeJSON {
      return {
        id: node.id,
        timestamp: node.timestamp,

        data: node.data,

        children: node.getChildren().map(TreeNodeMapper.toJSON),
      };
    }
  }
  

export class NavigationTreeMapper {
    static toJSON(tree: NavigationTree): NavigationTreeJSON {
        const root = tree.getRoot();
        const current = tree.getCurrent();
        const capacity = tree.getCapacity();
        const nodeCount = tree.size();
        
        return {
            root: root ? TreeNodeMapper.toJSON(root) : null,
            currentNodeId: current?.id ?? null,
            capacity: capacity,
            nodeCount: nodeCount,
        };
    }

    static fromJSON(json: NavigationTreeJSON): NavigationTree {
      if (!json.root) {
          return new NavigationTree(json.capacity ?? defaultSettings.capacity);
      }

      const root = TreeNodeMapper.fromJSON(json.root);
      const tree = new NavigationTree(json.capacity ?? defaultSettings.capacity, root);

      if (json.currentNodeId) tree.setCurrentById(json.currentNodeId);
      
      return tree;
    }
}
