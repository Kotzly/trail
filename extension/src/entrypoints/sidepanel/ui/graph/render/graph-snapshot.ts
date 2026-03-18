import type { NodeId } from '@shared/types/ids.js';
import type { NodeRenderModel, ConnectionSegment } from './types.js';
import type { LayoutMode, NodePosition } from '../types.js';

export type GraphSnapshot = {
  readonly version: number;
  readonly nodes: readonly NodeRenderModel[];
  readonly basePositions: ReadonlyMap<NodeId, NodePosition>;
  readonly connections: readonly ConnectionSegment[];
  readonly layoutMode: LayoutMode;
  readonly nodeWidth: number;
  readonly nodeHeight: number;
  readonly showConnections: boolean;
};

export function createGraphSnapshot(params: {
  version: number;
  nodes: NodeRenderModel[];
  basePositions: Map<NodeId, NodePosition>;
  connections: ConnectionSegment[];
  layoutMode: LayoutMode;
  nodeWidth: number;
  nodeHeight: number;
  showConnections: boolean;
}): GraphSnapshot {
  return Object.freeze({
    version: params.version,
    nodes: params.nodes,
    basePositions: params.basePositions,
    connections: params.connections,
    layoutMode: params.layoutMode,
    nodeWidth: params.nodeWidth,
    nodeHeight: params.nodeHeight,
    showConnections: params.showConnections,
  });
}
