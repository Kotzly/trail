import type { NavigationTree } from '../../../background/state/nav-tree.js';
import type { NodeId } from '../../../shared/types/ids.js';

export function getIncludedRootId(
  tree: NavigationTree | null,
  nodeIds: Iterable<NodeId>,
): NodeId | null {
  if (!tree) return null;
  const rootId = tree.getRoot?.()?.id ?? null;
  if (!rootId) return null;
  for (const id of nodeIds) {
    if (id === rootId) return rootId;
  }
  return null;
}
