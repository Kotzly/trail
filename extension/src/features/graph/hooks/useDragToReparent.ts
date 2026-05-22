import { useCallback, useMemo, useRef, useState } from "react";
import { useReactFlow, type Node, type NodeChange, type NodeMouseHandler } from "@xyflow/react";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { NodeId } from "@shared/types/ids.js";
import type { TrailNodeData } from "../types.js";
import { buildTreeMaps, isValidDropTarget } from "../reparent.js";
import { NODE_WIDTH, NODE_HEIGHT } from "../tree-layout.js";

export type DragState = {
  sourceId: NodeId | null;
  hoveredTargetId: NodeId | null;
  isValidTarget: boolean;
};

export type DragPosition = {
  id: string;
  x: number;
  y: number;
} | null;

type UseDragToReparentInput = {
  tree: NavigationTreeJSON | null;
  selectedNodeIds: Set<NodeId>;
  onSelectionChange: (nodeIds: Set<NodeId>) => void;
  onReparentNode: (nodeId: NodeId, newParentId: NodeId) => void;
};

type UseDragToReparentResult = {
  /** Drag-target validity slice (source / hovered / valid?). */
  dragState: DragState;
  /** Live cursor position mirror for the dragged node, in flow-space. */
  dragPosition: DragPosition;
  /** Tree root id — used by the shell to suppress draggable on the root node. */
  rootId: NodeId | null;
  /** Mirror live drag position from xyflow's NodeChange stream. */
  onNodesChange: (changes: NodeChange[]) => void;
  onNodeDragStart: NodeMouseHandler;
  onNodeDrag: NodeMouseHandler;
  onNodeDragStop: NodeMouseHandler;
};

/**
 * Drag-to-reparent state machine.
 *
 * Two slices of state, deliberately separated by update frequency:
 *
 *   • `dragState` (source + hovered + valid?) drives the validity ring
 *     on the source / hovered targets. Flips only on target-enter/exit
 *     — once or twice per drag.
 *
 *   • `dragPosition` mirrors the dragged node's live cursor position in
 *     flow-space. Updated on every `onNodesChange` tick (60–120Hz). In
 *     xyflow v12 controlled mode the rendered node position comes from
 *     the `nodes` prop — without a state update, the dragged node
 *     would stay glued at its layout position AND its incident edges
 *     would freeze (edge endpoints resolve through xyflow's internal
 *     nodeInternals, which only advances when the controlled `nodes`
 *     prop changes).
 *
 * The previous "imperative DOM via CSS variable" hack moved the node
 * visually but left nodeInternals stale, so edges didn't follow. The
 * earlier "round-trip through React state" attempt before that put
 * `dragOverride` inside the upstream display-nodes deps — forcing a
 * full-tree map + a `useNodeLifecycle` pass per cursor tick (~5000 ×
 * 2 iterations) — and that's where the 30–50ms perceived lag came
 * from, not React state itself.
 *
 * Fix: keep `dragPosition` OUT of the upstream memo deps. The caller
 * applies the override in a single downstream memo (one O(N) pass per
 * tick where only the dragged node gets a new object reference,
 * everything else passes through by identity).
 *
 * Fully-controlled-mode contract for `onNodesChange`:
 *   • position + dragging — live cursor position during a drag. xyflow
 *     tracks this internally between mousedown and mouseup; without
 *     mirroring it back into the controlled `nodes` array, the dragged
 *     node would render glued at its layout position and its incident
 *     edges would freeze. We mirror it into `dragPosition`, which the
 *     caller overlays.
 *
 * Other change types are safely ignored:
 *   • select — parent owns `selectedNodeIds`; xyflow reflects state
 *     back via the controlled `selected` field on each node.
 *   • add / remove — layout owns the node list. xyflow never adds or
 *     removes a node out of band in this mode.
 *   • dimensions — nodes ship pre-measured `measured` dims (set in
 *     transforms.ts) so xyflow's first measurement matches what we
 *     gave it and emits no further updates for unchanged geometry.
 *   • replace — not produced under current xyflow usage; would only
 *     fire if we adopted a feature like change-applied replacement.
 *
 * When upgrading @xyflow/react, audit the NodeChange union. If a new
 * type becomes load-bearing for fully-controlled mode, switch to
 * `applyNodeChanges` here and mirror the resulting list into parent
 * state. The drag-position split is the minimum that works today.
 */
export function useDragToReparent(input: UseDragToReparentInput): UseDragToReparentResult {
  const { tree, selectedNodeIds, onSelectionChange, onReparentNode } = input;
  const { getIntersectingNodes } = useReactFlow();

  const [dragState, setDragState] = useState<DragState>({
    sourceId: null,
    hoveredTargetId: null,
    isValidTarget: false,
  });
  const [dragPosition, setDragPosition] = useState<DragPosition>(null);

  // Parent / root lookup once per tree. Drives the per-frame
  // `isValidDropTarget` check during a drag — same rules the backend
  // enforces, so the user gets instant valid/invalid ring feedback.
  const treeMaps = useMemo(() => buildTreeMaps(tree), [tree]);
  const rootId = treeMaps.rootId;

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type !== "position" || !change.dragging || !change.position) continue;
      const { id } = change;
      const { x, y } = change.position;
      setDragPosition((prev) =>
        prev && prev.id === id && prev.x === x && prev.y === y ? prev : { id, x, y },
      );
    }
  }, []);

  const onNodeDragStart: NodeMouseHandler = useCallback(
    (_event, node) => {
      const sourceId = (node.data as TrailNodeData).nodeId;
      // Force single-node drag: clearing selection prevents xyflow from
      // moving every selected node together (we only track one
      // `dragPosition` slot, and reparent only acts on the source).
      if (selectedNodeIds.size > 0) onSelectionChange(new Set());
      setDragState({ sourceId, hoveredTargetId: null, isValidTarget: false });
    },
    [selectedNodeIds, onSelectionChange],
  );

  // Drag-target detection is the dominant per-pointermove cost
  // (xyflow's `getIntersectingNodes` does a linear scan across the
  // node list, ~120Hz on a fast pointing device). One rAF tick is
  // visually indistinguishable from per-event and caps the workload
  // at 60Hz on a maxed-out monitor.
  const dragRafRef = useRef<number | null>(null);
  const dragLatestNodeRef = useRef<Node | null>(null);

  const onNodeDrag: NodeMouseHandler = useCallback(
    (_event, node) => {
      dragLatestNodeRef.current = node;
      if (dragRafRef.current !== null) return;
      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = null;
        const current = dragLatestNodeRef.current;
        if (current === null) return;
        const sourceId = (current.data as TrailNodeData).nodeId;
        // `partial=true` — accept any overlap, not just full containment.
        // With nodes the same size, a dragged node almost never sits
        // entirely *inside* another one, so `false` would mean "no target
        // ever lights up." When several nodes overlap, prefer the one
        // whose center is closest to the dragged node's center (all coords
        // in flow-space, so the comparison is consistent).
        const intersecting = getIntersectingNodes(current, true).filter((n) => n.id !== current.id);
        if (intersecting.length === 0) {
          setDragState((prev) =>
            prev.hoveredTargetId === null && prev.sourceId === sourceId
              ? prev
              : { sourceId, hoveredTargetId: null, isValidTarget: false },
          );
          return;
        }
        const sourceW = current.measured?.width ?? current.width ?? NODE_WIDTH;
        const sourceH = current.measured?.height ?? current.height ?? NODE_HEIGHT;
        const sourceCx = current.position.x + sourceW / 2;
        const sourceCy = current.position.y + sourceH / 2;
        let best = intersecting[0]!;
        let bestDist = Infinity;
        for (const n of intersecting) {
          const w = n.measured?.width ?? n.width ?? NODE_WIDTH;
          const h = n.measured?.height ?? n.height ?? NODE_HEIGHT;
          const cx = n.position.x + w / 2;
          const cy = n.position.y + h / 2;
          const dx = cx - sourceCx;
          const dy = cy - sourceCy;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            best = n;
          }
        }
        const candidateId = (best.data as TrailNodeData).nodeId;
        const valid = isValidDropTarget(treeMaps, sourceId, candidateId);
        setDragState((prev) =>
          prev.sourceId === sourceId &&
          prev.hoveredTargetId === candidateId &&
          prev.isValidTarget === valid
            ? prev
            : { sourceId, hoveredTargetId: candidateId, isValidTarget: valid },
        );
      });
    },
    [getIntersectingNodes, treeMaps],
  );

  const onNodeDragStop: NodeMouseHandler = useCallback(
    (_event, node) => {
      // Cancel any pending intersect-check rAF — its setDragState would
      // race the drop and either restore a hover state or fire after we
      // already cleared it.
      if (dragRafRef.current !== null) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
      dragLatestNodeRef.current = null;

      const sourceId = (node.data as TrailNodeData).nodeId;
      const target = dragState.hoveredTargetId;
      const valid = dragState.isValidTarget;
      setDragState({ sourceId: null, hoveredTargetId: null, isValidTarget: false });
      setDragPosition(null);
      if (target !== null && valid) {
        onReparentNode(sourceId, target);
      }
    },
    [dragState, onReparentNode],
  );

  return {
    dragState,
    dragPosition,
    rootId,
    onNodesChange,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
  };
}
