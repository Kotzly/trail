import type { NavigationTree } from '../../../../background/state/nav-tree.js';
import type { Tag } from '../../../../shared/types/ids.js';
import type { NavigationNode } from '../../../../shared/types/node.js';

export type TagCounts = Map<Tag, number>;

function sortNodes(a: NavigationNode, b: NavigationNode): number {
  const delta = Number(b.timestamp) - Number(a.timestamp);
  if (delta !== 0) return delta;
  const aTitle = a.data.title ?? '';
  const bTitle = b.data.title ?? '';
  return aTitle.localeCompare(bTitle);
}

export function collectTagCounts(tree: NavigationTree | null): TagCounts {
  const counts: TagCounts = new Map();
  if (!tree) return counts;
  for (const node of tree.iter()) {
    const tags = node.data.tags ?? [];
    tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  }
  return counts;
}

export function collectTaggedNodes(tree: NavigationTree | null): NavigationNode[] {
  if (!tree) return [];
  const results: NavigationNode[] = [];
  for (const node of tree.iter()) {
    const tags = node.data.tags ?? [];
    if (tags.length > 0) results.push(node);
  }
  return results.sort(sortNodes);
}

export function filterNodesByTags(
  tree: NavigationTree | null,
  selected: Set<Tag>,
): NavigationNode[] {
  if (!tree || selected.size === 0) return [];
  const results: NavigationNode[] = [];
  for (const node of tree.iter()) {
    const tags = node.data.tags ?? [];
    for (const tag of tags) {
      if (selected.has(tag)) {
        results.push(node);
        break;
      }
    }
  }
  return results.sort(sortNodes);
}
