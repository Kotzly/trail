import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  SelectionMode,
  useStore,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../motion/relayout.css";
import "../motion/hover.css";
import "../motion/lifecycle.css";
import "../pane.css";
import type { TrailGraphProps, TrailNodeData } from "../types.js";
import { TrailNode } from "./TrailNode.js";
import { InlineRenameProvider } from "./inline-rename-context.js";
import { GraphControls } from "./GraphControls.js";
import { LodController } from "./LodController.js";
import { useGraphLayout } from "../hooks/useGraphLayout.js";
import { useCmdWheelZoom } from "../hooks/useCmdWheelZoom.js";
import { useHandleInternalsBatching } from "../hooks/useHandleInternalsBatching.js";
import { useDragToReparent } from "../hooks/useDragToReparent.js";
import { useReshapeMorph } from "../hooks/useReshapeMorph.js";
import { useCameraCentering } from "../hooks/useCameraCentering.js";
import { useMarqueePreservation } from "../hooks/useMarqueePreservation.js";
import type { NodeId } from "@shared/types/ids.js";
import { cn } from "@ui/lib/utils";
import { selectShowBackground } from "../lod.js";
import { useRelayoutEnabled } from "../motion/useRelayoutEnabled.js";
import { useHoverHighlightEnabled } from "../motion/useHoverHighlightEnabled.js";
import { useNodeLifecycle, useNodeLifecycleEnabled } from "../motion/useNodeLifecycle.js";

const nodeTypes = { trail: TrailNode };

const MULTI_SELECT_KEYS = ["Shift", "Meta", "Control"];

const defaultEdgeOptions = {
  type: "default",
  animated: false,
  style: {
    stroke: "var(--border)",
    strokeWidth: 1.5,
  },
} as const;

const proOptions = { hideAttribution: true } as const;

/**
 * Isolated Background subscriber. Keeping the `useStore` read inside a
 * leaf component means the parent `TrailGraphInner` doesn't re-render
 * when the user zooms across the background threshold — only this tiny
 * component flips, which is effectively free.
 */
function GraphBackground() {
  const showBackground = useStore(selectShowBackground);
  if (!showBackground) return null;
  return <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />;
}

// ── Component ────────────────────────────────────────────────────

function TrailGraphInner(props: TrailGraphProps) {
  const {
    tree,
    currentNodeId,
    openNodeIds,
    collapsedNodeIds,
    collapseAction,
    unfoldedChainIds,
    badgeExpandedIds,
    selectedNodeIds,
    nodeTabCounts,
    settings,
    precomputedPositions,
    spotlight,
    inlineRenameTargetId,
    onInlineRenameStart,
    onInlineRenameCommit,
    onInlineRenameCancel,
    onReparentNode,
    onNodeClick,
    onNodeContextMenu,
    onCollapseToggle,
    onBadgeCollapseToggle,
    onChainUnfoldToggle,
    onSelectionChange,
    children,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  useCmdWheelZoom(containerRef);

  const relayoutAnimated = useRelayoutEnabled();
  const hoverGlow = useHoverHighlightEnabled();

  const metadata = useMemo(
    () => ({
      currentNodeId,
      openNodeIds,
      nodeTabCounts,
      badgeExpandedIds,
      inlineRenameTargetId,
    }),
    [currentNodeId, openNodeIds, nodeTabCounts, badgeExpandedIds, inlineRenameTargetId],
  );

  const inlineRenameContextValue = useMemo(
    () => ({
      targetId: inlineRenameTargetId,
      onCommit: onInlineRenameCommit,
      onCancel: onInlineRenameCancel,
    }),
    [inlineRenameTargetId, onInlineRenameCommit, onInlineRenameCancel],
  );

  const layout = useGraphLayout({
    tree,
    settings,
    collapsedNodeIds,
    unfoldedChainIds,
    metadata,
    precomputedPositions,
  });

  const spotlightId = spotlight?.nodeId ?? null;
  const spotlightKind = spotlight?.kind ?? null;

  // Drag-to-reparent: owns drag-state + live cursor mirror + handlers.
  const drag = useDragToReparent({
    tree,
    selectedNodeIds,
    onSelectionChange,
    onReparentNode,
  });
  const dragSourceId = drag.dragState.sourceId;
  const dragHoveredId = drag.dragState.hoveredTargetId;
  const dragValid = drag.dragState.isValidTarget;
  const rootId = drag.rootId;

  const displayNodes = useMemo(
    () =>
      layout.nodes.map((n) => {
        const sel = selectedNodeIds.has(n.data.nodeId);
        const sp =
          spotlightId !== null && spotlightKind !== null && n.data.nodeId === spotlightId
            ? spotlightKind
            : undefined;

        let dragRole: TrailNodeData["dragRole"] = undefined;
        if (dragSourceId !== null) {
          if (n.data.nodeId === dragSourceId) dragRole = "source";
          else if (n.data.nodeId === dragHoveredId)
            dragRole = dragValid ? "valid-target" : "invalid-target";
        }

        // Root can't be reparented; suppressing draggable here stops the
        // visual "drag then snap back" gesture before it starts.
        const isDraggable = n.data.nodeId !== rootId;

        if (
          n.selected === sel &&
          n.data.spotlight === sp &&
          n.data.dragRole === dragRole &&
          n.draggable === isDraggable
        ) {
          return n;
        }
        return {
          ...n,
          selected: sel,
          draggable: isDraggable,
          data: { ...n.data, spotlight: sp, dragRole },
        };
      }),
    [
      layout.nodes,
      selectedNodeIds,
      spotlightId,
      spotlightKind,
      dragSourceId,
      dragHoveredId,
      dragValid,
      rootId,
    ],
  );

  const lifecycleEnabled = useNodeLifecycleEnabled();
  const lifecycleNodes = useNodeLifecycle(displayNodes, lifecycleEnabled);

  // Batched updateNodeInternals when handle assignments change between renders.
  useHandleInternalsBatching(layout.nodes);

  // Apply the live drag position as the final layer — kept outside the
  // upstream memos so a 60–120Hz pointermove tick triggers only this
  // single O(N) pass. Only the dragged node gets a new object
  // reference; every other node passes through by identity, so
  // xyflow's internal diff updates the one moved node + recomputes
  // only its incident edges.
  const finalNodes = useMemo(() => {
    if (!drag.dragPosition) return lifecycleNodes;
    const { id, x, y } = drag.dragPosition;
    return lifecycleNodes.map((n) => (n.id === id ? { ...n, position: { x, y } } : n));
  }, [lifecycleNodes, drag.dragPosition]);

  const hasNodes = finalNodes.length > 0;

  // Camera centering — initial-mount fallback + per-navigation follow.
  const { centerCurrent, canCenterCurrent, markExtensionClick } = useCameraCentering({
    tree,
    currentNodeId,
    positions: layout.positions,
    layoutMode: settings.layout.mode,
    hasNodes,
  });

  // Topology reshape (collapse / expand / chain-unfold) — fades edges
  // for the duration of the morph and pans the camera to the toggled
  // node so the user keeps a fixed focal point through the transition.
  const { isReshaping } = useReshapeMorph({
    collapseAction,
    positions: layout.positions,
  });

  // Pan / camera-move suppression. `panOnScroll` keeps the cursor
  // stationary while content slides under it, so during a pan every
  // node sliding past the cursor toggles `:hover`. With many nodes in
  // the viewbox this is N × (box-shadow + transition + z-index reorder)
  // per frame, which is the dominant pan-lag cost on large trees. The
  // `graph--panning` class kills pointer-events on all nodes for the
  // duration of the move, so :hover never matches.
  //
  // xyflow's panOnScroll handler already debounces the end event by
  // 150ms after the last wheel (see @xyflow/system createPanOnScrollHandler).
  // We flip the flag straight off on onMoveEnd — adding our own debounce
  // on top would extend the dead window for clicks. A click immediately
  // after a pan needs hover/pointer-events back instantly.
  const [isPanning, setIsPanning] = useState(false);
  const handleMoveStart = useCallback(() => setIsPanning(true), []);
  const handleMoveEnd = useCallback(() => setIsPanning(false), []);

  // Marquee + multi-selection preservation; Escape-to-clear listener.
  const marquee = useMarqueePreservation({ selectedNodeIds, onSelectionChange });

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      // Modifier-click = multi-select, handled by ReactFlow — don't navigate
      if (event.shiftKey || event.metaKey || event.ctrlKey) return;
      const data = node.data as { nodeId?: NodeId; url?: string };
      if (data.nodeId === undefined) return;

      // Check if click landed on a badge inside the node. Badges mark
      // themselves with `data-fold-action` (chain unfold) or
      // `data-collapse-action` (subtree expand/recollapse) so single
      // clicks on chips toggle state instead of navigating to the URL.
      const target = event.target as HTMLElement | null;
      const actionEl = target?.closest("[data-fold-action], [data-collapse-action]");
      if (actionEl) {
        const fold = actionEl.getAttribute("data-fold-action");
        const collapse = actionEl.getAttribute("data-collapse-action");
        if (fold === "toggle") {
          onChainUnfoldToggle(data.nodeId);
          return;
        }
        if (collapse === "badge-toggle") {
          onBadgeCollapseToggle(data.nodeId);
          return;
        }
      }

      if (data.url !== undefined) {
        // Mark this click so the centering effect can tell extension-initiated
        // navigation from external browser navigation. When the tab update
        // lands and currentNodeId matches, we know the user clicked.
        markExtensionClick(data.nodeId);
        onNodeClick(data.nodeId, String(data.url));
      }
    },
    [onNodeClick, onChainUnfoldToggle, onBadgeCollapseToggle, markExtensionClick],
  );

  // Clicking empty pane clears multi-selection — feels like every other
  // canvas tool. With `selectionOnDrag` on, ReactFlow treats pane drags
  // as marquee starts; a click without drag fires `onPaneClick` and we
  // wipe the selection. Single node clicks already collapse selection
  // to that node via ReactFlow's internal handling, so no extra work
  // needed there. Escape mirrors the same gesture for keyboard users
  // (handled inside `useMarqueePreservation`).
  const handlePaneClick = useCallback(() => {
    if (selectedNodeIds.size > 0) onSelectionChange(new Set());
  }, [selectedNodeIds, onSelectionChange]);

  const handleNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      const data = node.data as { nodeId?: NodeId };
      if (data.nodeId !== undefined) {
        onNodeContextMenu(data.nodeId, {
          x: event.clientX,
          y: event.clientY,
        });
      }
    },
    [onNodeContextMenu],
  );

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (event, node) => {
      const data = node.data as {
        nodeId?: NodeId;
        childCount?: number;
        foldedAncestorCount?: number;
        isChainUnfolded?: boolean;
      };
      if (data.nodeId === undefined) return;
      // Double-click on the title text = start inline rename. Marked via
      // `data-rename-trigger` on the title `<span>` so the rest of the
      // node still falls through to collapse/unfold behaviour.
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-rename-trigger]")) {
        onInlineRenameStart(data.nodeId);
        return;
      }
      // Chain fold takes priority over subtree collapse:
      //   - foldedAncestorCount > 0 → tip is folded, unfold
      //   - isChainUnfolded        → tip was unfolded, refold
      //   - else                   → normal subtree collapse/expand
      if ((data.foldedAncestorCount ?? 0) > 0 || data.isChainUnfolded) {
        onChainUnfoldToggle(data.nodeId);
        return;
      }
      if ((data.childCount ?? 0) > 0) {
        onCollapseToggle(data.nodeId);
      }
    },
    [onCollapseToggle, onChainUnfoldToggle, onInlineRenameStart],
  );

  return (
    <InlineRenameProvider value={inlineRenameContextValue}>
      <div
        ref={containerRef}
        className={cn(
          "min-h-0 w-full flex-1",
          relayoutAnimated && "graph--relayout-animated",
          hoverGlow && "graph--hover-glow",
          lifecycleEnabled && "graph--lifecycle-on",
          isReshaping && "graph--reshaping",
          isPanning && "graph--panning",
        )}
        onPointerDownCapture={marquee.onContainerPointerDown}
        onPointerUpCapture={marquee.onContainerPointerUp}
      >
        <ReactFlow
          nodes={finalNodes}
          edges={layout.edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onNodeContextMenu={handleNodeContextMenu}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodesChange={drag.onNodesChange}
          onNodeDragStart={drag.onNodeDragStart}
          onNodeDrag={drag.onNodeDrag}
          onNodeDragStop={drag.onNodeDragStop}
          onPaneClick={handlePaneClick}
          onSelectionChange={marquee.onSelectionChange}
          onSelectionStart={marquee.onSelectionStart}
          onSelectionEnd={marquee.onSelectionEnd}
          onMoveStart={handleMoveStart}
          onMoveEnd={handleMoveEnd}
          selectionOnDrag
          selectionMode={SelectionMode.Partial}
          multiSelectionKeyCode={MULTI_SELECT_KEYS}
          // ReactFlow's default `deleteKeyCode` is "Backspace" — it
          // intercepts Backspace and triggers its own (unused) onNodesDelete
          // callback, swallowing the event before tinykeys sees it. Disable
          // entirely so our keyboard handler in useShortcuts owns delete.
          deleteKeyCode={null}
          // Cull is OFF (xyflow default). Earlier this was ON to avoid
          // always-mounted DOM cost on huge trees, but a 2026-05-22
          // far-LOD pan trace (Trace-20260522T214936.json.gz, 345
          // wheels) showed the cull was the per-frame bottleneck:
          // each wheel cost ~11.7 `commitHostMount` and ~14.8
          // `setAttribute` samples because nodes at the viewport
          // edge mounted/unmounted on every tick. Each mount paid
          // for xyflow's ResizeObserver firing `updateNodeInternals`
          // + a store `set({})` waking every subscriber, plus three
          // forced layouts (`getBoundingClientRect`,
          // `getComputedStyle`, `getDimensions`).
          //
          // Off-viewport nodes always-mounted are cheap during pure
          // pan: xyflow gives them `visibility: hidden` so paint
          // skips them, `useStore` subscriptions shallow-bail
          // because `internals.positionAbsolute` doesn't change on
          // pan (only the viewport transform mutates), and per-node
          // `contain: layout style` (pane.css) caps style-recalc
          // scope. Layout/style cost is bounded; mount-churn cost
          // is not.
          onlyRenderVisibleElements
          nodesDraggable
          nodeDragThreshold={5}
          nodesConnectable={false}
          connectOnClick={false}
          panOnDrag={false}
          panOnScroll
          panOnScrollSpeed={1}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          fitView={false}
          minZoom={0.05}
          maxZoom={3}
          proOptions={proOptions}
          defaultEdgeOptions={defaultEdgeOptions}
        >
          <GraphBackground />
          <LodController targetRef={containerRef} />
          <GraphControls onCenterCurrent={centerCurrent} canCenterCurrent={canCenterCurrent} />
          {children}
        </ReactFlow>
      </div>
    </InlineRenameProvider>
  );
}

export function TrailGraph(props: TrailGraphProps) {
  return (
    <ReactFlowProvider>
      <TrailGraphInner {...props} />
    </ReactFlowProvider>
  );
}
