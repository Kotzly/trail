export interface TreeNode {
  id: string;
  label: string;
  children: string[];
}

export interface Position {
  x: number;
  y: number;
}

export type LayoutMode = "tree" | "radial" | "mindmap";

const TREE_H_SPACING = 110;
const TREE_V_SPACING = 90;
const RADIAL_RADIUS_STEP = 120;
const MINDMAP_H_SPACING = 140;
const MINDMAP_V_SPACING = 60;

/**
 * Calculate tree layout positions (top-down hierarchy).
 * Returns a map of nodeId -> {x, y} centered around (cx, cy).
 */
export function treeLayout(
  nodes: TreeNode[],
  rootId: string,
  cx: number,
  cy: number,
): Map<string, Position> {
  const map = new Map<string, TreeNode>();
  for (const n of nodes) map.set(n.id, n);

  const positions = new Map<string, Position>();
  const levels: string[][] = [];

  function assignLevel(id: string, level: number) {
    if (!levels[level]) levels[level] = [];
    levels[level].push(id);
    const node = map.get(id);
    if (node) {
      for (const child of node.children) {
        assignLevel(child, level + 1);
      }
    }
  }
  assignLevel(rootId, 0);

  for (let lvl = 0; lvl < levels.length; lvl++) {
    const row = levels[lvl];
    const totalWidth = (row.length - 1) * TREE_H_SPACING;
    for (let i = 0; i < row.length; i++) {
      positions.set(row[i], {
        x: cx - totalWidth / 2 + i * TREE_H_SPACING,
        y: cy - 160 + lvl * TREE_V_SPACING,
      });
    }
  }

  return positions;
}

/**
 * Calculate radial layout positions (circular, radiating from root).
 */
export function radialLayout(
  nodes: TreeNode[],
  rootId: string,
  cx: number,
  cy: number,
): Map<string, Position> {
  const map = new Map<string, TreeNode>();
  for (const n of nodes) map.set(n.id, n);

  const positions = new Map<string, Position>();
  positions.set(rootId, { x: cx, y: cy });

  const levels: string[][] = [];

  function assignLevel(id: string, level: number) {
    if (!levels[level]) levels[level] = [];
    levels[level].push(id);
    const node = map.get(id);
    if (node) {
      for (const child of node.children) {
        assignLevel(child, level + 1);
      }
    }
  }
  assignLevel(rootId, 0);

  for (let lvl = 1; lvl < levels.length; lvl++) {
    const row = levels[lvl];
    const radius = lvl * RADIAL_RADIUS_STEP;
    for (let i = 0; i < row.length; i++) {
      const angle =
        (2 * Math.PI * i) / row.length - Math.PI / 2;
      positions.set(row[i], {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    }
  }

  return positions;
}

/**
 * Calculate mindmap layout (horizontal branching left/right from root).
 */
export function mindmapLayout(
  nodes: TreeNode[],
  rootId: string,
  cx: number,
  cy: number,
): Map<string, Position> {
  const map = new Map<string, TreeNode>();
  for (const n of nodes) map.set(n.id, n);

  const positions = new Map<string, Position>();
  positions.set(rootId, { x: cx, y: cy });

  const root = map.get(rootId);
  if (!root) return positions;

  let leftIdx = 0;
  let rightIdx = 0;

  function layoutBranch(
    id: string,
    depth: number,
    side: "left" | "right",
    ySlot: number,
  ) {
    const xDir = side === "left" ? -1 : 1;
    positions.set(id, {
      x: cx + xDir * depth * MINDMAP_H_SPACING,
      y: cy + ySlot * MINDMAP_V_SPACING,
    });
    const node = map.get(id);
    if (node) {
      for (let i = 0; i < node.children.length; i++) {
        const childSlot =
          side === "left" ? ySlot - (i * 0.8) : ySlot + (i * 0.8);
        layoutBranch(node.children[i], depth + 1, side, childSlot);
      }
    }
  }

  for (let i = 0; i < root.children.length; i++) {
    const side: "left" | "right" = i % 2 === 0 ? "right" : "left";
    const slot = side === "left" ? -(++leftIdx) : ++rightIdx;
    layoutBranch(root.children[i], 1, side, slot);
  }

  return positions;
}

/**
 * Interpolate between two position maps.
 */
export function interpolatePositions(
  from: Map<string, Position>,
  to: Map<string, Position>,
  progress: number,
): Map<string, Position> {
  const result = new Map<string, Position>();
  for (const [id, fromPos] of from) {
    const toPos = to.get(id);
    if (toPos) {
      result.set(id, {
        x: fromPos.x + (toPos.x - fromPos.x) * progress,
        y: fromPos.y + (toPos.y - fromPos.y) * progress,
      });
    }
  }
  return result;
}
