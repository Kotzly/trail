/**
 * Converts NavigationTreeJSON → elkjs graph and back.
 */

import type { ElkNode, ElkExtendedEdge } from "elkjs";
import type { NodeId } from "@shared/types/ids.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { LayoutMode } from "./types.js";

// ── Constants ──────────────────────────────────────────────────────

const NODE_WIDTH = 160;
const NODE_HEIGHT = 52;

// ── Tree → ELK graph ──────────────────────────────────────────────

export type ElkGraphInput = {
  tree: NavigationTreeJSON;
  collapsedNodeIds: Set<NodeId>;
  mode: LayoutMode;
  nodeSpacing: number;
  layerSpacing: number;
};

function walkNode(
  node: NavigationNodeJSON,
  collapsedNodeIds: Set<NodeId>,
  children: ElkNode[],
  edges: ElkExtendedEdge[],
): void {
  children.push({
    id: String(node.id),
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  });

  if (collapsedNodeIds.has(node.id)) return;

  for (const child of node.children) {
    edges.push({
      id: `${node.id}->${child.id}`,
      sources: [String(node.id)],
      targets: [String(child.id)],
    });
    walkNode(child, collapsedNodeIds, children, edges);
  }
}

function getLayoutOptions(input: ElkGraphInput): Record<string, string> {
  const { mode, nodeSpacing, layerSpacing } = input;

  const common: Record<string, string> = {
    "elk.spacing.nodeNode": String(nodeSpacing),
    "elk.spacing.edgeNode": String(nodeSpacing / 2),
  };

  switch (mode) {
    case "tree":
      return {
        ...common,
        "elk.algorithm": "org.eclipse.elk.mrtree",
        "elk.direction": "DOWN",
        "elk.spacing.nodeNode": String(layerSpacing),
      };

    case "mindmap":
      return {
        ...common,
        "elk.algorithm": "org.eclipse.elk.mrtree",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": String(layerSpacing),
      };

    case "radial":
      return {
        ...common,
        "elk.algorithm": "org.eclipse.elk.radial",
        "elk.radial.centerOnRoot": "true",
        "elk.radial.radius": String(layerSpacing),
        "elk.radial.wedgeCriteria": "NODE_SIZE",
      };
  }
}

export function treeToElkGraph(input: ElkGraphInput): ElkNode {
  const { tree, collapsedNodeIds } = input;

  const children: ElkNode[] = [];
  const edges: ElkExtendedEdge[] = [];

  if (tree.root) {
    walkNode(tree.root, collapsedNodeIds, children, edges);
  }

  return {
    id: "root",
    layoutOptions: getLayoutOptions(input),
    children,
    edges,
  };
}

// ── ELK result → position map ──────────────────────────────────────

export function elkResultToPositions(
  elkGraph: ElkNode,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  if (elkGraph.children) {
    for (const child of elkGraph.children) {
      positions.set(child.id, {
        x: child.x ?? 0,
        y: child.y ?? 0,
      });
    }
  }

  return positions;
}

export { NODE_WIDTH, NODE_HEIGHT };
