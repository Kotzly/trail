/**
 * Converts NavigationTreeJSON → d3-hierarchy layout → positioned node map.
 *
 * d3-hierarchy's Reingold-Tilford algorithm is purpose-built for trees and
 * runs in linear time, producing clean, compact layouts for tree and mindmap
 * modes.
 */

import { hierarchy, tree as d3tree } from "d3-hierarchy";
import type { NodeId } from "@shared/types/ids.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { LayoutMode } from "@shared/types/settings.js";
import { type ChainFoldInfo, EMPTY_FOLD_INFO } from "./fold-chains.js";

// ── Constants ──────────────────────────────────────────────────────

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;

// ── Tree → d3-hierarchy layout ──────────────────────────────────────

export type LayoutGraphInput = {
  tree: NavigationTreeJSON;
  collapsedNodeIds: Set<NodeId>;
  mode: LayoutMode;
  nodeSpacing: number;
  layerSpacing: number;
  foldInfo?: ChainFoldInfo;
};

export function computeTreePositions(
  input: LayoutGraphInput,
): Map<string, { x: number; y: number }> {
  const { tree, collapsedNodeIds, mode, nodeSpacing, layerSpacing } = input;
  const foldInfo = input.foldInfo ?? EMPTY_FOLD_INFO;

  const positions = new Map<string, { x: number; y: number }>();
  if (!tree.root) return positions;

  // Build hierarchy. Skip children of collapsed nodes. For chain-fold:
  // when a child is a chain head, substitute its tip so d3 positions
  // the tip at depth = head's depth (the hidden intermediates take no
  // space). Hidden nodes are therefore never visited by d3, preventing
  // visual gaps between the chain's pre-head parent and the tip.
  // If the tree's root is itself a chain head, promote its tip to be
  // d3's root so the tip lands at the root's origin position.
  const d3Root = foldInfo.headToTip.get(tree.root.id) ?? tree.root;
  const root = hierarchy<NavigationNodeJSON>(d3Root, (node) => {
    if (collapsedNodeIds.has(node.id)) return null;
    if (foldInfo.headToTip.size === 0) return node.children;
    return node.children.map((c) => foldInfo.headToTip.get(c.id) ?? c);
  });

  // nodeSize = [sibling-axis span, layer-axis span] in d3's native (x, y) frame.
  // Tree (TB): x = horizontal across siblings, y = vertical depth.
  // Mindmap (LR): we rotate afterwards, so the sibling axis carries node heights.
  const isMindmap = mode === "mindmap";
  const siblingSize = (isMindmap ? NODE_HEIGHT : NODE_WIDTH) + nodeSpacing;
  const layerSize = (isMindmap ? NODE_WIDTH : NODE_HEIGHT) + layerSpacing;

  const layout = d3tree<NavigationNodeJSON>()
    .nodeSize([siblingSize, layerSize])
    // Uniform spacing between any two adjacent siblings keeps subtrees
    // visually balanced. Default d3 separation (2× for non-siblings) gaps
    // subtrees unnecessarily wide for our dense navigation trees.
    .separation(() => 1);

  layout(root);

  // d3-hierarchy places node centers; React Flow wants top-left corners.
  // Mindmap mode rotates the native (x, y) → (y, x) so depth runs horizontally.
  root.each((n) => {
    const id = String(n.data.id);
    // d3-hierarchy types x/y as possibly undefined, but layout() always sets them.
    const nx = n.x ?? 0;
    const ny = n.y ?? 0;
    const cx = isMindmap ? ny : nx;
    const cy = isMindmap ? nx : ny;
    positions.set(id, {
      x: cx - NODE_WIDTH / 2,
      y: cy - NODE_HEIGHT / 2,
    });
  });

  return positions;
}

// ── Flat position record (for background cache) ───────────────────

export function computeTreePositionsRecord(
  input: LayoutGraphInput,
): Record<string, { x: number; y: number }> {
  return Object.fromEntries(computeTreePositions(input));
}

export { NODE_WIDTH, NODE_HEIGHT };
