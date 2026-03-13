import type { NodeId } from '@shared/types/ids.js';
import type { NavigationNode } from '@shared/types/node.js';
import type { NavigationTree } from '@background/state/nav-tree.js';
import type { CollapseScope } from './graph-canvas-types.js';

export function collectSubtreeIds(node: NavigationNode): Set<NodeId> {
  const ids = new Set<NodeId>();
  const walk = (n: NavigationNode) => {
    ids.add(n.id);
    for (const child of n.getChildren()) walk(child);
  };
  walk(node);
  return ids;
}

export const buildCollapseScope = (
  tree: NavigationTree | null,
  rootIds: Set<NodeId> | null,
): CollapseScope => {
  const scope: CollapseScope = new Map();
  if (!tree || !rootIds || rootIds.size === 0) return scope;
  const rootSet = new Set<NodeId>();
  rootIds.forEach((id) => {
    const node = tree.findNodeById(id);
    if (!node) return;
    rootSet.add(id);
  });
  if (rootSet.size === 0) return scope;

  const visit = (node: NavigationNode, rootId: NodeId) => {
    if (rootSet.has(node.id)) return;
    scope.set(node.id, rootId);
    node.getChildren().forEach((child) => visit(child, rootId));
  };

  rootSet.forEach((rootId) => {
    const rootNode = tree.findNodeById(rootId);
    if (!rootNode) return;
    rootNode.getChildren().forEach((child) => visit(child, rootId));
  });

  return scope;
};
