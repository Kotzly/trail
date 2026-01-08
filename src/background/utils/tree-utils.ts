import type { NodeId, TabId } from '../../shared/types/ids';
import type { TreeEntry } from '../../shared/types/node';
import type { NavigationTree } from '../state/nav-tree';
import type { TreeNode } from '../state/tree-node';

/**
 * Recursively set windowId for a node and all its children.
 * Note: This modifies the TreeNode directly (adds windowId property).
 */
export function setWindowIdRecursive(
  node: TreeNode | null,
  windowId: number
): void {
  if (!node) return;
  
  // Add windowId property to node (TreeNode doesn't have it by default)
  (node as any).windowId = windowId;
  
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => setWindowIdRecursive(child, windowId));
  }
}

/**
 * Merge a source root into a target root as a child branch.
 * This is used when a tab is moved to a different window.
 * 
 * Note: This function assumes the tree supports multiple roots (forest mode).
 * For single-tree mode, this may not be applicable.
 */
export function mergeRootInto(
  tree: NavigationTree,
  sourceRoot: TreeNode,
  targetRoot: TreeNode
): boolean {
  if (!tree || !sourceRoot || !targetRoot || sourceRoot === targetRoot) {
    return false;
  }
  
  // For single-tree mode, we can't merge roots
  // This function is kept for compatibility but may need adaptation
  // TODO: Adapt for single-tree mode if needed
  
  // Remove isRoot flag and set parent
  (sourceRoot as any).isRoot = false;
  sourceRoot.parent = targetRoot;
  targetRoot.children.push(sourceRoot);
  
  return true;
}

/**
 * Create a node in single-tree mode.
 * If tree has no root, create the first root.
 * Otherwise, create a child node under the existing root.
 */
export function createNodeInSingleTree(
  tree: NavigationTree,
  entry: TreeEntry
): TreeNode | null {
  if (!tree) return null;
  
  const root = tree.getRoot();
  
  if (!root) {
    // Create first root
    return tree.init(entry);
  }
  
  // Save current node
  const prev = tree.getCurrent();
  
  // Set root as current temporarily
  tree.setCurrent(root);
  
  // Navigate (creates child or returns existing)
  const newNode = tree.navigate(entry, { backOnRevisit: true });
  
  // Restore previous current if it was different
  if (prev && prev.id !== newNode.id) {
    tree.setCurrent(prev);
  }
  
  return newNode;
}

/**
 * Get the owning window ID for a node by finding its root.
 * Returns null if root doesn't have windowId set.
 */
export function getOwnerWindowId(
  tree: NavigationTree,
  nodeId: NodeId
): number | null {
  const root = findRootForNode(tree, nodeId);
  return root ? (root as any).windowId ?? null : null;
}

/**
 * Ensure the root that owns nodeId has a windowId.
 * Tries to infer from tab mappings, or uses fallback.
 */
export function ensureRootOwner(
  tree: NavigationTree,
  nodeId: NodeId,
  fallbackWindowId: number | null = null
): number | null {
  const root = findRootForNode(tree, nodeId);
  if (!root) return null;
  
  // If root already has windowId, return it
  if ((root as any).windowId) {
    return (root as any).windowId;
  }
  
  // Try to infer from node's tab (would need tabManager, but we'll handle that in node-utils)
  // For now, use fallback
  if (fallbackWindowId !== null) {
    (root as any).windowId = fallbackWindowId;
    return fallbackWindowId;
  }
  
  return null;
}

/**
 * Find the root node for a given node ID.
 * Traverses up the parent chain until finding the root.
 */
export function findRootForNode(
  tree: NavigationTree,
  nodeId: NodeId
): TreeNode | null {
  return tree.findRootForNode(nodeId);
}
