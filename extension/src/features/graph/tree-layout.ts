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

// Minimum sibling-axis pitch for mindmap (LR) mode, in px.
//
// Mindmap siblings stack along the *vertical* axis, the same axis the
// camera sweeps when following a deep navigation chain (depth runs
// horizontally). At the natural pitch (NODE_HEIGHT 60 + nodeSpacing
// 16–32 ≈ 76–92px) siblings sit ~2× tighter than tree mode's
// horizontal pitch (NODE_WIDTH 160 + nodeSpacing ≈ 176–192px).
//
// That density matters because `onlyRenderVisibleElements` (the
// viewport cull, ON — see TrailGraph) mounts/unmounts each node as it
// crosses the viewport edge, and every remount pays for xyflow's
// ResizeObserver → updateNodeInternals → forced reflow + store
// broadcast. The number of nodes crossing the edge per pan frame is
// inversely proportional to this pitch, so mindmap's tight packing
// churned multiples more remounts than tree and read as pan lag.
//
// Flooring the mindmap sibling pitch at one node-height of clearance
// (2 × NODE_HEIGHT) roughly halves the per-frame boundary-crossing
// rate, bringing churn toward tree levels. The trade-off is a taller
// mindmap (more vertical pan to traverse a subtree). Tune here:
// higher = smoother pan, sparser layout. Tree mode is unaffected.
const MINDMAP_MIN_SIBLING_PITCH = 2 * NODE_HEIGHT; // 120px

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
  // when a child is hidden, substitute its visible tips so d3
  // positions them at depth = hidden node's depth (the hidden
  // intermediates take no space). Hidden nodes are therefore never
  // visited by d3, preventing visual gaps between a visible parent
  // and the tips.
  //
  // With fork support, one hidden node can map to multiple tips, so
  // we flatMap. If the tree's root is itself a hidden head with a
  // single tip, promote that tip to be d3's root so it lands at the
  // root's origin position. With multiple tips at the root, fall back
  // to using the original root — d3 needs exactly one root, and the
  // alternative (synthetic virtual root) shifts every node down by a
  // layer. The hidden root will still be filtered out of the position
  // map (its id is skipped by callers via the hiddenIds set).
  const rootRedirects = foldInfo.headToTips.get(tree.root.id);
  const d3Root: NavigationNodeJSON =
    rootRedirects && rootRedirects.length === 1 ? rootRedirects[0]! : tree.root;
  const root = hierarchy<NavigationNodeJSON>(d3Root, (node) => {
    if (collapsedNodeIds.has(node.id)) return null;
    if (foldInfo.headToTips.size === 0) return node.children;
    const out: NavigationNodeJSON[] = [];
    for (const child of node.children) {
      const tips = foldInfo.headToTips.get(child.id);
      if (tips !== undefined) {
        for (const t of tips) out.push(t);
      } else {
        out.push(child);
      }
    }
    return out;
  });

  // nodeSize = [sibling-axis span, layer-axis span] in d3's native (x, y) frame.
  // Tree (TB): x = horizontal across siblings, y = vertical depth.
  // Mindmap (LR): we rotate afterwards, so the sibling axis carries node heights.
  const isMindmap = mode === "mindmap";
  // Mindmap floors the sibling pitch to cap viewport-cull remount churn
  // (see MINDMAP_MIN_SIBLING_PITCH). Tree uses its natural pitch.
  const siblingSize = isMindmap
    ? Math.max(NODE_HEIGHT + nodeSpacing, MINDMAP_MIN_SIBLING_PITCH)
    : NODE_WIDTH + nodeSpacing;
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
