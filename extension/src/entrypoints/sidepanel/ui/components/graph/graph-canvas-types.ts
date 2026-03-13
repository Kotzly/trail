import type { NodeId } from '@shared/types/ids.js';
import type { NavigationNode } from '@shared/types/node.js';
import type { Settings } from '@shared/types/settings.js';
import type { TabState } from '@shared/types/tabs.js';
import type { TreeUpdatedInput } from '@shared/rpc/contracts.js';
import type { TagDefinition } from '@shared/types/tags.js';
import type { NavigationTree } from '@background/state/nav-tree.js';
import type { ConnectionQuality, GraphRenderMetrics } from '../../graph/render/GraphPixiRenderer.js';
import type { ViewState } from '../../graph/types.js';

export type GraphTool = 'hand' | 'select';

export type SearchState = {
  results: NodeId[];
  index: number;
  navStep: number;
  active: boolean;
};

export type ContextMenuState =
  | {
      type: 'node';
      nodeId: NodeId;
      position: { x: number; y: number };
    }
  | {
      type: 'bulk';
      nodeIds: NodeId[];
      position: { x: number; y: number };
    };

export type LayoutUpdate = {
  nodeId: NodeId;
  layout: {
    offsetX?: number;
    offsetY?: number;
    radial?: { angleDelta: number; radiusDelta: number };
  };
};

export type LayoutUpdateMap = Map<NodeId, LayoutUpdate['layout']>;

export type DragNodeState = {
  nodeId: NodeId;
  startNodeX: number;
  startNodeY: number;
  baseOffsetX: number;
  baseOffsetY: number;
  radial?: {
    rootCenterX: number;
    rootCenterY: number;
    baseAngle: number;
    baseRadius: number;
    ancestorAngle: number;
    ancestorRadius: number;
    minRadius: number;
  };
};

export type DragReparentPreview = {
  draggedId: NodeId;
  originalParentId: NodeId;
  /** The node we'd reparent to on drop — null when detached but not near any target. */
  targetId: NodeId | null;
  /** IDs of the dragged subtree (used to exclude from snap candidates). */
  subtreeIds: Set<NodeId>;
};

export type GraphCanvasProps = {
  tree: NavigationTree | null;
  treeUpdate: { reason: TreeUpdatedInput['reason']; at: number } | null;
  currentNodeId: NodeId | null;
  openNodeIds: Set<NodeId>;
  collapsedNodeIds: Set<NodeId>;
  collapseVersion: number;
  collapseAction: CollapseAction | null;
  nodeTabCounts: Record<NodeId, number>;
  nodeRecency: Record<NodeId, number>;
  tabStates: Record<NodeId, TabState>;
  search: SearchState;
  settings: Settings | null;
  showConnections: boolean;
  detailMode: 'full' | 'low' | 'dot';
  connectionQuality: ConnectionQuality;
  graphView: ViewState;
  tool: GraphTool;
  selectedNodeIds: Set<NodeId>;
  hoverNodeId: NodeId | null;
  resetVersion: number;
  viewIntent: TreeUpdatedInput['view'] | null;
  tagDefs: Record<string, TagDefinition>;
  onGraphToolChange: (tool: GraphTool) => void;
  onSelectedNodeIdsChange: (ids: Set<NodeId>) => void;
  onClearSelection: () => void;
  onGraphViewChange: (view: Partial<ViewState>) => void;
  onSetHoverNodeId: (nodeId: NodeId | null) => void;
  onOpenContextMenu: (menu: ContextMenuState) => void;
  onClearViewIntent: () => void;
  onExpandNodes: (nodeIds: NodeId[]) => void;
  onRenderMetrics: (metrics: GraphRenderMetrics) => void;
  editorActive: boolean;
  pickTarget: { type: 'duplicate'; sourceNodeId: NodeId } | null;
  onPickTargetComplete: () => void;
  fullViewEnabled: boolean;
  recencyOrderingV2Enabled: boolean;
  showControls: boolean;
  /** Limit initial zoom so at most ~25×36 nodes are visible (Spotlight mode). */
  compactInitialView?: boolean;
  /** When set, called instead of the default navigateTo on node click. */
  onNodeActivate?: (nodeId: NodeId, url: string) => void;
};

export type SelectionBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PointerInfo = {
  clientX: number;
  clientY: number;
  button: number;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
};

export type PointerHitTarget = {
  nodeId: NodeId;
  target: 'node' | 'collapse-icon';
};

export type NodeAnimationType = 'enter' | 'exit' | 'move';

export type NodeAnimationState = {
  id: NodeId;
  type: NodeAnimationType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startTime: number;
  duration: number;
};

export type OpenAnimationState = {
  id: NodeId;
  from: number;
  to: number;
  startTime: number;
  duration: number;
};

export type ParticleState = {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  life: number;
  age: number;
  radius: number;
};

export type CollapseAction = {
  kind: 'collapse' | 'expand';
  nodeIds: Set<NodeId>;
};

export type CollapseScope = Map<NodeId, NodeId>;
