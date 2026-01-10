import type { NavigationNode, NavigationNodeJSON } from "../types/node.js";
import { TreeNode } from "../../background/state/tree-node.js";
import { NavigationTreeJSON } from "../types/tree.js";
import { NavigationTree } from "../../background/state/nav-tree.js";
import { defaultSettings } from "../../background/services/settings.js";

export class TreeNodeMapper {
    static fromJSON(json: NavigationNodeJSON, parent?: NavigationNode): NavigationNode {
      const node = new TreeNode(json.data, parent, json.id);
  
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
      else tree.clearCurrent();
      
      return tree;
    }
}