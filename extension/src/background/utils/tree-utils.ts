import type { NavigationNode, NodeData } from '@shared/types/node.js';
import type { NavigationTree } from '../state/nav-tree.js';
import type { TreeNode } from '../state/tree-node.js';

/**
 * Create a node in single-tree mode.
 * If tree has no root, create the first root.
 * Otherwise, create a child node under the existing root.
 */
export function createNode(
  tree: NavigationTree,
  data: NodeData
): NavigationNode | null {
  const node = tree.navigate(data);
  return node;
}
