import type { NodeId } from "@shared/types/ids.js";
import type { TabState } from "@shared/types/tabs.js";
import type { NavigationNode } from "@shared/types/node.js";

export interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  verticalGap: number;
  horizontalGap: number;
}

export type LayoutMode = "tree" | "mindmap" | "radial";

export interface RadialLayoutConfig {
  angleWeightExp: number;
  minSpanFactor: number;
  minSpanAbs: number;
  requiredScale: number;
  depthGapBase: number;
  depthGapGrowth: number;
  effectiveWidth: number;
}

export interface NodePosition {
  x: number;
  y: number;
  node: NavigationNode;
}

export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface ViewState {
  translateX: number;
  translateY: number;
  scale: number;
}

export interface GraphAPI {
  centerOnNode: (nodeId: NodeId, animate?: boolean) => void;
  fitToView: (animate?: boolean) => void;
  wrapper: HTMLElement;
}

export interface RenderGraphOptions {
  openNodeIds?: Set<NodeId> | null;
  tabStates?: Record<NodeId, TabState>;
  nodeTabCounts?: Record<NodeId, number>;
}

export interface TreeData {
  root?: NavigationNode;
  currentNodeId?: NodeId | null;
  nodeCount?: number;
}
