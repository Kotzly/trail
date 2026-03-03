import type { NodeId } from '@shared/types/ids.js';
import type { NavigationNode } from '@shared/types/node.js';
import type { LayoutConfig, NodePosition, CanvasBounds, RadialLayoutConfig } from '../types.js';
import { PADDING } from './config.js';

type GetChildren = (node: NavigationNode) => NavigationNode[];

type TidyNode = {
  node: NavigationNode;
  parent: TidyNode | null;
  children: TidyNode[];
  depth: number;
  number: number;
  breadth: number;
  prelim: number;
  mod: number;
  change: number;
  shift: number;
  thread: TidyNode | null;
  ancestor: TidyNode;
};

function buildTidyTree(
  node: NavigationNode,
  getChildren: GetChildren,
  parent: TidyNode | null,
  depth: number,
  number: number,
): TidyNode {
  const tidy: TidyNode = {
    node,
    parent,
    depth,
    number,
    children: [],
    breadth: 0,
    prelim: 0,
    mod: 0,
    change: 0,
    shift: 0,
    thread: null,
    ancestor: null as unknown as TidyNode,
  };
  tidy.ancestor = tidy;
  const children = getChildren(node);
  tidy.children = children.map((child, idx) =>
    buildTidyTree(child, getChildren, tidy, depth + 1, idx + 1),
  );
  return tidy;
}

function createTidyTree(root: NavigationNode, getChildren: GetChildren): TidyNode {
  return buildTidyTree(root, getChildren, null, 0, 1);
}

function computeTidyBreadths(root: TidyNode, baseSeparation: number): void {
  const separation = (a: TidyNode, b: TidyNode): number => {
    const sameParent = a.parent === b.parent;
    return baseSeparation * (sameParent ? 1 : 1.05);
  };

  const leftSibling = (node: TidyNode): TidyNode | null => {
    if (!node.parent) return null;
    if (node.number <= 1) return null;
    return node.parent.children[node.number - 2] ?? null;
  };

  const leftmostSibling = (node: TidyNode): TidyNode | null => {
    if (!node.parent || node.parent.children.length === 0) return null;
    return node.parent.children[0] ?? null;
  };

  const nextLeft = (node: TidyNode): TidyNode | null => {
    return node.children.length > 0 ? node.children[0]! : node.thread;
  };

  const nextRight = (node: TidyNode): TidyNode | null => {
    return node.children.length > 0 ? node.children[node.children.length - 1]! : node.thread;
  };

  const moveSubtree = (wl: TidyNode, wr: TidyNode, shift: number) => {
    const subtrees = wr.number - wl.number;
    if (subtrees <= 0) return;
    const ratio = shift / subtrees;
    wr.change -= ratio;
    wr.shift += shift;
    wl.change += ratio;
    wr.prelim += shift;
    wr.mod += shift;
  };

  const executeShifts = (node: TidyNode) => {
    let shift = 0;
    let change = 0;
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      const child = node.children[i]!;
      child.prelim += shift;
      child.mod += shift;
      change += child.change;
      shift += child.shift + change;
    }
  };

  const ancestor = (vim: TidyNode, v: TidyNode, defaultAncestor: TidyNode): TidyNode => {
    if (vim.ancestor.parent === v.parent) return vim.ancestor;
    return defaultAncestor;
  };

  const apportion = (v: TidyNode, defaultAncestor: TidyNode): TidyNode => {
    const w = leftSibling(v);
    if (!w) return defaultAncestor;

    let vip: TidyNode = v;
    let vop: TidyNode = v;
    let vim: TidyNode = w;
    let vom: TidyNode = leftmostSibling(v) ?? w;

    let sip = vip.mod;
    let sop = vop.mod;
    let sim = vim.mod;
    let som = vom.mod;

    let nextRightVim = nextRight(vim);
    let nextLeftVip = nextLeft(vip);
    while (nextRightVim && nextLeftVip) {
      vim = nextRightVim;
      vip = nextLeftVip;
      vom = nextLeft(vom) ?? vom;
      vop = nextRight(vop) ?? vop;
      vop.ancestor = v;

      const shift = (vim.prelim + sim) - (vip.prelim + sip) + separation(vim, vip);
      if (shift > 0) {
        const a = ancestor(vim, v, defaultAncestor);
        moveSubtree(a, v, shift);
        sip += shift;
        sop += shift;
      }

      sim += vim.mod;
      sip += vip.mod;
      som += vom.mod;
      sop += vop.mod;

      nextRightVim = nextRight(vim);
      nextLeftVip = nextLeft(vip);
    }

    if (nextRightVim && !nextRight(vop)) {
      vop.thread = nextRightVim;
      vop.mod += sim - sop;
    }
    if (nextLeftVip && !nextLeft(vom)) {
      vom.thread = nextLeftVip;
      vom.mod += sip - som;
      return v;
    }

    return defaultAncestor;
  };

  const firstWalk = (node: TidyNode): void => {
    if (node.children.length === 0) {
      const left = leftSibling(node);
      node.prelim = left ? left.prelim + separation(node, left) : 0;
      return;
    }

    let defaultAncestor = node.children[0]!;
    node.children.forEach((child) => {
      firstWalk(child);
      defaultAncestor = apportion(child, defaultAncestor);
    });

    executeShifts(node);

    const firstChild = node.children[0]!;
    const lastChild = node.children[node.children.length - 1]!;
    const midpoint = (firstChild.prelim + lastChild.prelim) / 2;
    const left = leftSibling(node);
    if (left) {
      node.prelim = left.prelim + separation(node, left);
      node.mod = node.prelim - midpoint;
    } else {
      node.prelim = midpoint;
    }
  };

  const secondWalk = (node: TidyNode, modSum: number): void => {
    node.breadth = node.prelim + modSum;
    node.children.forEach((child) => secondWalk(child, modSum + node.mod));
  };

  firstWalk(root);
  secondWalk(root, 0);
}


export function calculateLayout(
  root: NavigationNode,
  layoutConfig: LayoutConfig,
  getChildren: GetChildren = (node) => node.getChildren?.() ?? [],
): { positions: Map<NodeId, NodePosition>, width: number } {
  const positions = new Map<NodeId, NodePosition>();
  const { nodeWidth, nodeHeight, verticalGap, horizontalGap } = layoutConfig;
  const tidyRoot = createTidyTree(root, getChildren);
  const baseSeparation = Math.max(nodeWidth + horizontalGap, 1);
  computeTidyBreadths(tidyRoot, baseSeparation);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  // Track bounding box for normalization.

  const assignPositions = (node: TidyNode): void => {
    const centerX = node.breadth;
    const x = centerX - nodeWidth / 2;
    const y = node.depth * (nodeHeight + verticalGap);
    positions.set(node.node.id, { x, y, node: node.node });
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + nodeWidth);
    node.children.forEach((child) => assignPositions(child));
  };

  assignPositions(tidyRoot);

  const rootPos = positions.get(root.id);
  if (rootPos) {
    const shiftX = -(rootPos.x + nodeWidth / 2);
    const shiftY = -(rootPos.y + nodeHeight / 2);
    if (shiftX !== 0 || shiftY !== 0) {
      positions.forEach((pos, id) => {
        positions.set(id, { ...pos, x: pos.x + shiftX, y: pos.y + shiftY });
      });
      minX += shiftX;
      minY += shiftY;
      maxX += shiftX;
    }
  }

  const width = maxX - minX + PADDING * 2;
  return { positions, width };
}

/**
 * Mindmap layout (left/right). Root stays centered, its children split into
 * left and right columns, and descendants inherit the side.
 */
export function calculateMindmapLayout(
  root: NavigationNode,
  layoutConfig: LayoutConfig,
  getChildren: GetChildren = (node) => node.getChildren?.() ?? [],
  options?: { sortWithinSide?: (children: NavigationNode[]) => NavigationNode[] },
): { positions: Map<NodeId, NodePosition>, width: number } {
  const positions = new Map<NodeId, NodePosition>();
  const { nodeWidth, nodeHeight, verticalGap, horizontalGap } = layoutConfig;
  const subtreeHeights = new Map<NodeId, number>();

  function calcHeights(node: NavigationNode | null): number {
    if (!node) return 0;
    const children = getChildren(node);
    if (children.length === 0) {
      subtreeHeights.set(node.id, nodeHeight);
      return nodeHeight;
    }
    let total = 0;
    children.forEach((child, idx) => {
      total += calcHeights(child);
      if (idx < children.length - 1) total += verticalGap;
    });
    const height = Math.max(nodeHeight, total);
    subtreeHeights.set(node.id, height);
    return height;
  }

  calcHeights(root);

  const rootChildren = getChildren(root);
  const sorted = [...rootChildren].sort((a, b) => {
    return (subtreeHeights.get(b.id) ?? 0) - (subtreeHeights.get(a.id) ?? 0);
  });
  const leftChildren: NavigationNode[] = [];
  const rightChildren: NavigationNode[] = [];
  let leftHeight = 0;
  let rightHeight = 0;
  sorted.forEach((child) => {
    const height = subtreeHeights.get(child.id) ?? nodeHeight;
    if (leftHeight <= rightHeight) {
      leftChildren.push(child);
      leftHeight += height;
    } else {
      rightChildren.push(child);
      rightHeight += height;
    }
  });

  if (options?.sortWithinSide) {
    const sortFn = options.sortWithinSide;
    leftChildren.splice(0, leftChildren.length, ...sortFn(leftChildren));
    rightChildren.splice(0, rightChildren.length, ...sortFn(rightChildren));
  }

  const rootX = 0;
  const rootY = 0;
  positions.set(root.id, { x: rootX, y: rootY, node: root });

  const depthStep = nodeWidth + horizontalGap;
  const baseSeparation = Math.max(nodeHeight + verticalGap, 1);

  const layoutSide = (children: NavigationNode[], direction: 1 | -1): void => {
    if (children.length === 0) return;
    const tidyRoot = createTidyTree(root, (node) =>
      node.id === root.id ? children : getChildren(node),
    );
    computeTidyBreadths(tidyRoot, baseSeparation);
    const rootBreadth = tidyRoot.breadth;

    const assignPositions = (node: TidyNode): void => {
      if (node.node.id !== root.id) {
        const x = rootX + direction * node.depth * depthStep;
        const y = rootY + node.breadth - rootBreadth;
        positions.set(node.node.id, { x, y, node: node.node });
      }
      node.children.forEach((child) => assignPositions(child));
    };

    assignPositions(tidyRoot);
  };

  layoutSide(leftChildren, -1);
  layoutSide(rightChildren, 1);

  const rootPos = positions.get(root.id);
  if (rootPos) {
    const shiftX = -(rootPos.x + nodeWidth / 2);
    const shiftY = -(rootPos.y + nodeHeight / 2);
    if (shiftX !== 0 || shiftY !== 0) {
      positions.forEach((pos, id) => {
        positions.set(id, { ...pos, x: pos.x + shiftX, y: pos.y + shiftY });
      });
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + nodeHeight);
  });

  const width = maxX - minX + PADDING * 2;
  return { positions, width };
}

/**
 * Radial layout (all directions). Nodes are placed on concentric rings by depth,
 * and each node gets an angular span proportional to its subtree size.
 */
export function calculateRadialLayout(
  root: NavigationNode,
  layoutConfig: RadialLayoutConfig,
  baseLayout: LayoutConfig,
  getChildren: GetChildren = (node) => node.getChildren?.() ?? [],
): { positions: Map<NodeId, NodePosition>, width: number } {
  const positions = new Map<NodeId, NodePosition>();
  const { nodeWidth, nodeHeight } = baseLayout;

  const ANGLE_WEIGHT_EXP = layoutConfig.angleWeightExp;
  const MIN_SPAN_FACTOR = layoutConfig.minSpanFactor;
  const MIN_SPAN_ABS = layoutConfig.minSpanAbs;
  const REQUIRED_SCALE = layoutConfig.requiredScale;
  const baseRadius = 0;
  const depthGapBase = layoutConfig.depthGapBase;
  const depthGapGrowth = layoutConfig.depthGapGrowth;
  const effectiveWidth = layoutConfig.effectiveWidth;

  type TidyNode = {
    node: NavigationNode;
    parent: TidyNode | null;
    children: TidyNode[];
    depth: number;
    number: number;
    x: number;
    prelim: number;
    mod: number;
    change: number;
    shift: number;
    thread: TidyNode | null;
    ancestor: TidyNode;
  };

  const buildTidy = (
    node: NavigationNode,
    parent: TidyNode | null,
    depth: number,
    number: number,
  ): TidyNode => {
    const tidy: TidyNode = {
      node,
      parent,
      depth,
      number,
      children: [],
      x: 0,
      prelim: 0,
      mod: 0,
      change: 0,
      shift: 0,
      thread: null,
      ancestor: null as unknown as TidyNode,
    };
    tidy.ancestor = tidy;
    const children = getChildren(node);
    tidy.children = children.map((child, idx) => buildTidy(child, tidy, depth + 1, idx + 1));
    return tidy;
  };

  const tidyRoot = buildTidy(root, null, 0, 1);

  const leafCounts = new Map<NodeId, number>();
  const countLeaves = (node: TidyNode): number => {
    if (node.children.length === 0) {
      leafCounts.set(node.node.id, 1);
      return 1;
    }
    let total = 0;
    node.children.forEach((child) => {
      total += countLeaves(child);
    });
    leafCounts.set(node.node.id, total);
    return total;
  };
  const totalLeaves = countLeaves(tidyRoot);
  const totalLeafWeight = Math.pow(Math.max(totalLeaves, 1), ANGLE_WEIGHT_EXP);

  const baseSeparation = 1 / Math.max(MIN_SPAN_FACTOR, 0.05);
  const nonSiblingScale = 1 + Math.max(MIN_SPAN_ABS, 0) * 1.5;
  const globalSepScale = 0.6 + 0.4 * ANGLE_WEIGHT_EXP;

  const separation = (a: TidyNode, b: TidyNode): number => {
    const base = a.parent === b.parent ? baseSeparation : baseSeparation * nonSiblingScale;
    const weightA = Math.pow(leafCounts.get(a.node.id) ?? 1, ANGLE_WEIGHT_EXP);
    const weightB = Math.pow(leafCounts.get(b.node.id) ?? 1, ANGLE_WEIGHT_EXP);
    const weight = Math.sqrt(weightA * weightB);
    const weightRatio = totalLeafWeight > 0 ? weight / totalLeafWeight : 0;
    const sizeScale = 1 + weightRatio * 0.6;
    return base * globalSepScale * sizeScale;
  };

  const leftSibling = (node: TidyNode): TidyNode | null => {
    if (!node.parent) return null;
    if (node.number <= 1) return null;
    return node.parent.children[node.number - 2] ?? null;
  };

  const leftmostSibling = (node: TidyNode): TidyNode | null => {
    if (!node.parent || node.parent.children.length === 0) return null;
    return node.parent.children[0] ?? null;
  };

  const nextLeft = (node: TidyNode): TidyNode | null => {
    return node.children.length > 0 ? node.children[0]! : node.thread;
  };

  const nextRight = (node: TidyNode): TidyNode | null => {
    return node.children.length > 0 ? node.children[node.children.length - 1]! : node.thread;
  };

  const moveSubtree = (wl: TidyNode, wr: TidyNode, shift: number) => {
    const subtrees = wr.number - wl.number;
    if (subtrees <= 0) return;
    const ratio = shift / subtrees;
    wr.change -= ratio;
    wr.shift += shift;
    wl.change += ratio;
    wr.prelim += shift;
    wr.mod += shift;
  };

  const executeShifts = (node: TidyNode) => {
    let shift = 0;
    let change = 0;
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      const child = node.children[i]!;
      child.prelim += shift;
      child.mod += shift;
      change += child.change;
      shift += child.shift + change;
    }
  };

  const ancestor = (vim: TidyNode, v: TidyNode, defaultAncestor: TidyNode): TidyNode => {
    if (vim.ancestor.parent === v.parent) return vim.ancestor;
    return defaultAncestor;
  };

  const apportion = (v: TidyNode, defaultAncestor: TidyNode): TidyNode => {
    const w = leftSibling(v);
    if (!w) return defaultAncestor;

    let vip: TidyNode = v;
    let vop: TidyNode = v;
    let vim: TidyNode = w;
    let vom: TidyNode = leftmostSibling(v) ?? w;

    let sip = vip.mod;
    let sop = vop.mod;
    let sim = vim.mod;
    let som = vom.mod;

    let nextRightVim = nextRight(vim);
    let nextLeftVip = nextLeft(vip);
    while (nextRightVim && nextLeftVip) {
      vim = nextRightVim;
      vip = nextLeftVip;
      vom = nextLeft(vom) ?? vom;
      vop = nextRight(vop) ?? vop;
      vop.ancestor = v;

      const shift = (vim.prelim + sim) - (vip.prelim + sip) + separation(vim, vip);
      if (shift > 0) {
        const a = ancestor(vim, v, defaultAncestor);
        moveSubtree(a, v, shift);
        sip += shift;
        sop += shift;
      }

      sim += vim.mod;
      sip += vip.mod;
      som += vom.mod;
      sop += vop.mod;

      nextRightVim = nextRight(vim);
      nextLeftVip = nextLeft(vip);
    }

    if (nextRightVim && !nextRight(vop)) {
      vop.thread = nextRightVim;
      vop.mod += sim - sop;
    }
    if (nextLeftVip && !nextLeft(vom)) {
      vom.thread = nextLeftVip;
      vom.mod += sip - som;
      return v;
    }

    return defaultAncestor;
  };

  const firstWalk = (node: TidyNode): void => {
    if (node.children.length === 0) {
      const left = leftSibling(node);
      node.prelim = left ? left.prelim + separation(node, left) : 0;
      return;
    }

    let defaultAncestor = node.children[0]!;
    node.children.forEach((child) => {
      firstWalk(child);
      defaultAncestor = apportion(child, defaultAncestor);
    });

    executeShifts(node);

    const firstChild = node.children[0]!;
    const lastChild = node.children[node.children.length - 1]!;
    const midpoint = (firstChild.prelim + lastChild.prelim) / 2;
    const left = leftSibling(node);
    if (left) {
      node.prelim = left.prelim + separation(node, left);
      node.mod = node.prelim - midpoint;
    } else {
      node.prelim = midpoint;
    }
  };

  const secondWalk = (node: TidyNode, modSum: number): void => {
    node.x = node.prelim + modSum;
    node.children.forEach((child) => secondWalk(child, modSum + node.mod));
  };

  firstWalk(tidyRoot);
  secondWalk(tidyRoot, 0);

  const nodesByDepth = new Map<number, TidyNode[]>();
  let minXTidy = Infinity;
  let maxXTidy = -Infinity;
  let maxDepth = 0;
  const walk = (node: TidyNode): void => {
    minXTidy = Math.min(minXTidy, node.x);
    maxXTidy = Math.max(maxXTidy, node.x);
    maxDepth = Math.max(maxDepth, node.depth);
    const list = nodesByDepth.get(node.depth) ?? [];
    list.push(node);
    nodesByDepth.set(node.depth, list);
    node.children.forEach((child) => walk(child));
  };
  walk(tidyRoot);

  const angleById = new Map<NodeId, number>();
  const totalAngle = Math.PI * 2;
  const startAngle = -Math.PI / 2;
  const span = maxXTidy - minXTidy;
  const hasSpan = span > 1e-6;
  const step = totalLeaves > 1 && hasSpan ? span / (totalLeaves - 1) : 0;
  const denom = hasSpan ? span + step : 0;

  nodesByDepth.forEach((nodes) => {
    nodes.forEach((node) => {
      let angle = startAngle;
      if (hasSpan && denom > 0) {
        const normalized = (node.x - minXTidy + step / 2) / denom;
        angle = startAngle + normalized * totalAngle;
      }
      angleById.set(node.node.id, angle);
    });
  });

  const radiusByDepth = new Map<number, number>();
  radiusByDepth.set(0, baseRadius);
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const prevRadius = radiusByDepth.get(depth - 1) ?? baseRadius;
    const depthGap = depthGapBase * (1 + (depth - 1) * depthGapGrowth);
    let radius = prevRadius + depthGap;
    const nodes = nodesByDepth.get(depth) ?? [];
    if (nodes.length > 1 && hasSpan) {
      const angles = nodes
        .map((node) => angleById.get(node.node.id) ?? startAngle)
        .sort((a, b) => a - b);
      let minDelta = Infinity;
      for (let i = 0; i < angles.length; i += 1) {
        const current = angles[i]!;
        const next = angles[(i + 1) % angles.length]!;
        let delta = next - current;
        if (delta <= 0) delta += totalAngle;
        minDelta = Math.min(minDelta, delta);
      }
      const requiredArcWidth = Math.max(effectiveWidth * REQUIRED_SCALE, 0);
      const safeDelta = Math.max(minDelta, 1e-4);
      const requiredRadius = requiredArcWidth / safeDelta;
      radius = Math.max(radius, requiredRadius);
    }
    radiusByDepth.set(depth, radius);
  }

  nodesByDepth.forEach((nodes) => {
    nodes.forEach((node) => {
      const radius = radiusByDepth.get(node.depth) ?? baseRadius;
      const angle = angleById.get(node.node.id) ?? startAngle;
      const x = radius * Math.cos(angle) - nodeWidth / 2;
      const y = radius * Math.sin(angle) - nodeHeight / 2;
      positions.set(node.node.id, { x, y, node: node.node });
    });
  });

  const rootPos = positions.get(root.id);
  if (rootPos) {
    const shiftX = -(rootPos.x + nodeWidth / 2);
    const shiftY = -(rootPos.y + nodeHeight / 2);
    if (shiftX !== 0 || shiftY !== 0) {
      positions.forEach((pos, id) => {
        positions.set(id, { ...pos, x: pos.x + shiftX, y: pos.y + shiftY });
      });
    }
  }

  const maxRadius = Math.max(...Array.from(radiusByDepth.values()), nodeWidth);
  return { positions, width: maxRadius * 2 + nodeWidth };
}


/**
 * Pre-compute exact visual span (tidy-tree width) for every subtree.
 *
 * Runs Reingold-Tilford on the tree rooted at `root` with unsorted children
 * (collapse-filtered only), then walks post-order to determine
 * span = maxBreadth − minBreadth for each node's subtree.
 *
 * The returned Map<NodeId, number> gives each node a weight proportional to
 * how much horizontal space its subtree occupies — regardless of sibling order.
 */
export function computeSubtreeSpans(
  root: NavigationNode,
  getChildren: GetChildren,
  baseSeparation: number,
): Map<NodeId, number> {
  const tidyRoot = createTidyTree(root, getChildren);
  computeTidyBreadths(tidyRoot, baseSeparation);

  const spans = new Map<NodeId, number>();

  function walk(node: TidyNode): { min: number; max: number } {
    let min = node.breadth;
    let max = node.breadth;
    for (const child of node.children) {
      const childExtent = walk(child);
      if (childExtent.min < min) min = childExtent.min;
      if (childExtent.max > max) max = childExtent.max;
    }
    spans.set(node.node.id, max - min);
    return { min, max };
  }

  walk(tidyRoot);
  return spans;
}

/**
 * Get canvas bounds from positions.
 */
export function getCanvasBounds(
  positions: Map<NodeId, NodePosition>,
  nodeWidth: number,
  nodeHeight: number
): CanvasBounds {
  if (positions.size === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  positions.forEach((pos: NodePosition) => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + nodeHeight);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
  };
}
