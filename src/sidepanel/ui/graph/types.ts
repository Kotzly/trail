import type { NodeId } from '../../../shared/types/ids';
import type { TreeNode } from '../../../background/state/tree-node';
import { TabState } from '../../../shared/types/tabs';

export interface LayoutConfig {
  nodeWidth: number;
  nodeHeight: number;
  verticalGap: number;
  horizontalGap: number;
  rootGap: number;
  compact: boolean;
}

export interface NodePosition {
  x: number;
  y: number;
  node: TreeNode;
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
  node: TreeNode;
  position: NodePosition;
  currentId: NodeId | null;
  onNavigate: (node: TreeNode) => void;
  openNodeIds: Set<NodeId> | null;
  nodeTabCounts: Record<NodeId, number>;
}

export interface RenderGraphOptions {
  onNavigate: (node: TreeNode) => void;
  openNodeIds?: Set<NodeId> | null;
  compactGraph?: boolean;
  tabStates?: Record<NodeId, TabState>;
  selectionMenuInstant?: boolean;
  nodeTabCounts?: Record<NodeId, number>;
  showOrphanTrees?: boolean;
}

export interface TreeData {
  root?: TreeNode;
  roots?: TreeNode[];
  currentNodeId?: NodeId | null;
  nodeCount?: number;
}

