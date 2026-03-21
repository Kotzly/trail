import type { NodeId } from "@shared/types/ids.js";
import type { NodeRenderModel, ConnectionSegment } from "./types.js";
import type { LayoutMode, NodePosition } from "../types.js";

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

export type SnapshotDiff = {
  readonly added: readonly NodeRenderModel[];
  readonly removed: readonly NodeId[];
  readonly moved: readonly NodeRenderModel[];
};

export function diffSnapshots(prev: GraphSnapshot, next: GraphSnapshot): SnapshotDiff {
  const prevById = new Map<NodeId, NodeRenderModel>();
  for (const node of prev.nodes) prevById.set(node.id, node);

  const nextById = new Map<NodeId, NodeRenderModel>();
  for (const node of next.nodes) nextById.set(node.id, node);

  const added: NodeRenderModel[] = [];
  const moved: NodeRenderModel[] = [];
  const removed: NodeId[] = [];

  for (const node of next.nodes) {
    const old = prevById.get(node.id);
    if (!old) {
      added.push(node);
    } else if (old.x !== node.x || old.y !== node.y) {
      moved.push(node);
    }
    // Nodes at same position with same id are unchanged — skip
  }

  for (const node of prev.nodes) {
    if (!nextById.has(node.id)) {
      removed.push(node.id);
    }
  }

  return { added, removed, moved };
}

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
