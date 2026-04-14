/**
 * Radial tree layout.
 *
 * Runs d3-hierarchy's cluster (dendrogram) layout on a [0, 2π] × radius
 * canvas, then maps the Cartesian (x=angle, y=radius) output into polar
 * screen coordinates. Cluster keeps all leaves on the outer ring and
 * uniform separation spreads them evenly around 2π regardless of tree
 * imbalance — tree layout bunched leaves on one side when one subtree
 * dominated the leaf count.
 */

import { hierarchy, cluster as d3cluster } from "d3-hierarchy";
import type { NodeId } from "@shared/types/ids.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { RadialLayoutSettings } from "@shared/types/settings.js";
import { NODE_WIDTH, NODE_HEIGHT } from "./tree-layout.js";

export function computeRadialPositions(
  tree: NavigationTreeJSON,
  collapsedNodeIds: Set<NodeId>,
  settings: RadialLayoutSettings,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (!tree.root) return positions;

  const root = hierarchy<NavigationNodeJSON>(tree.root, (node) =>
    collapsedNodeIds.has(node.id) ? null : node.children,
  );

  let maxDepth = 0;
  root.each((n) => {
    if (n.depth > maxDepth) maxDepth = n.depth;
  });

  if (maxDepth === 0) {
    positions.set(String(tree.root.id), { x: -NODE_WIDTH / 2, y: -NODE_HEIGHT / 2 });
    return positions;
  }

  // Radius must satisfy two constraints:
  //  1. enough depth spacing (depthGapBase × NODE_WIDTH per ring);
  //  2. outer circumference fits all leaves without overlap — otherwise
  //     wide-but-shallow trees collapse into illegible cluster at small radius.
  const depthRadius = settings.depthGapBase * NODE_WIDTH * maxDepth;
  const numLeaves = root.leaves().length;
  const leafRadius = (numLeaves * NODE_WIDTH * 1.3) / (2 * Math.PI);
  const radius = Math.max(depthRadius, leafRadius);

  // separation=1 → leaves are distributed uniformly across [0, 2π].
  // Anything else (depth-scaled or sibling-preferring) causes bunching
  // when the tree is imbalanced.
  d3cluster<NavigationNodeJSON>()
    .size([2 * Math.PI, radius])
    .separation(() => 1)(root);

  root.each((n) => {
    const overrides = n.data.data.layout?.radial;
    // d3 puts x ∈ [0, 2π]; subtract π/2 so angle=0 points up.
    const angle = (n.x ?? 0) - Math.PI / 2 + (overrides?.angleDelta ?? 0);
    const r = (n.y ?? 0) + (overrides?.radiusDelta ?? 0);

    positions.set(String(n.data.id), {
      x: r * Math.cos(angle) - NODE_WIDTH / 2,
      y: r * Math.sin(angle) - NODE_HEIGHT / 2,
    });
  });

  return positions;
}
