import type { NodeId } from '../../../shared/types/ids';
import { TabState } from '../../../shared/types/tabs';
import { NavigationNode } from '../../../shared/types/node';

export interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  verticalGap: number;
  horizontalGap: number;
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

export interface GraphNodeOptions {
  node: NavigationNode;
  position: NodePosition;
  currentId: NodeId | null;
  openNodeIds: Set<NodeId> | null;
  nodeTabCounts: Record<NodeId, number>;
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

