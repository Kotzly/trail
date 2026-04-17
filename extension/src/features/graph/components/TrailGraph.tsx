import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  SelectionMode,
  useReactFlow,
  useStore,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TrailGraphProps, TrailNode as TrailNodeType } from "../types.js";
import { TrailNode } from "./TrailNode.js";
import { GraphControls } from "./GraphControls.js";
import { useGraphLayout } from "../hooks/useGraphLayout.js";
import { NODE_WIDTH, NODE_HEIGHT } from "../tree-layout.js";
import type { NodeId } from "@shared/types/ids.js";
import { selectShowBackground } from "../lod.js";

const nodeTypes = { trail: TrailNode };

const defaultEdgeOptions = {
  type: "default",
  animated: false,
  style: {
    stroke: "var(--border)",
    strokeWidth: 1.5,
  },
} as const;

// ── Component ────────────────────────────────────────────────────

function TrailGraphInner(props: TrailGraphProps) {
  const {
    tree,
    currentNodeId,
    openNodeIds,
    collapsedNodeIds,
    selectedNodeIds,
    nodeTabCounts,
    settings,
    precomputedPositions,
    onNodeClick,
    onNodeContextMenu,
    onCollapseToggle,
    onSelectionChange,
    onLayoutModeChange,
  } = props;

  const { fitView, setCenter, getViewport, setViewport } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const initialFitDone = useRef(false);

  const showBackground = useStore(selectShowBackground);

  const metadata = useMemo(
    () => ({
      currentNodeId,
      openNodeIds,
      nodeTabCounts,
    }),
    [currentNodeId, openNodeIds, nodeTabCounts],
  );

  const layout = useGraphLayout({
    tree,
    settings,
    collapsedNodeIds,
    metadata,
    precomputedPositions,
  });

  const displayNodes = useMemo(
    () =>
      layout.nodes.map((n) => {
        const sel = selectedNodeIds.has(n.data.nodeId);
        return n.selected === sel ? n : { ...n, selected: sel };
      }),
    [layout.nodes, selectedNodeIds],
  );

  // Cursor-anchored zoom on Cmd/Ctrl+wheel and macOS trackpad pinch.
  //
  // Why a custom handler instead of xyflow's zoomActivationKeyCode +
  // zoomOnScroll/zoomOnPinch:
  //   1. xyflow tracks the activation key via useKeyPress (window
  //      keydown/keyup). The sidepanel's window only sees keydown when
  //      it has focus — so reaching for Cmd+scroll on the graph while
  //      focus is still on the page being browsed is a no-op.
  //   2. macOS trackpad pinch arrives as a wheel event with synthetic
  //      ctrlKey=true (no real key pressed). xyflow's zoomOnPinch is
  //      gated on the same useKeyPress, so it has the same dead spot.
  //
  // Reading event.metaKey/ctrlKey directly off the wheel event sidesteps
  // both: modifier state on the event reflects OS-level state regardless
  // of focus, and pinch's synthetic ctrlKey is indistinguishable from a
  // real Ctrl press here — which is exactly what we want.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();

      const vp = getViewport();
      const clamped = Math.max(-30, Math.min(30, e.deltaY));
      const factor = 1 - clamped * 0.006;
      const newZoom = Math.min(3, Math.max(0.05, vp.zoom * factor));

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scale = newZoom / vp.zoom;

      setViewport({
        x: mouseX - (mouseX - vp.x) * scale,
        y: mouseY - (mouseY - vp.y) * scale,
        zoom: newZoom,
      });
    };

    el.addEventListener("wheel", handler, { capture: true, passive: false });
    return () =>
      el.removeEventListener("wheel", handler, { capture: true } as EventListenerOptions);
  }, [getViewport, setViewport]);

  // Center on current node once on first data
  useEffect(() => {
    if (displayNodes.length > 0 && !initialFitDone.current) {
      initialFitDone.current = true;

      const currentNode = currentNodeId
        ? displayNodes.find((n) => n.data.nodeId === currentNodeId)
        : null;

      if (currentNode?.position) {
        setCenter(
          currentNode.position.x + NODE_WIDTH / 2,
          currentNode.position.y + NODE_HEIGHT / 2,
          { zoom: 1, duration: 300 },
        );
      } else {
        fitView({ padding: 0.2, duration: 300 });
      }
    }
  }, [displayNodes.length, fitView, setCenter, currentNodeId]);

  // Sync ReactFlow selection → store
  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: TrailNodeType[] }) => {
      const ids = new Set<NodeId>(nodes.map((n) => n.data.nodeId));
      onSelectionChange(ids);
    },
    [onSelectionChange],
  );

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      // Shift+click = multi-select, handled by ReactFlow — don't navigate
      if (event.shiftKey) return;
      const data = node.data as { nodeId?: NodeId; url?: string };
      if (data.nodeId !== undefined && data.url !== undefined) {
        onNodeClick(data.nodeId, String(data.url));
      }
    },
    [onNodeClick],
  );

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
    (_event, node) => {
      const data = node.data as { nodeId?: NodeId; childCount?: number };
      if (data.nodeId !== undefined && (data.childCount ?? 0) > 0) {
        onCollapseToggle(data.nodeId);
      }
    },
    [onCollapseToggle],
  );

  return (
    <div ref={containerRef} className="min-h-0 w-full flex-1">
      <ReactFlow
        nodes={displayNodes}
        edges={layout.edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onNodeDoubleClick={handleNodeDoubleClick}
        onSelectionChange={handleSelectionChange}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
        onlyRenderVisibleElements
        nodesDraggable={false}
        nodesConnectable={false}
        connectOnClick={false}
        panOnDrag={false}
        panOnScroll
        panOnScrollSpeed={1}
        zoomOnScroll={false}
        zoomOnPinch={false}
        fitView={false}
        minZoom={0.05}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={defaultEdgeOptions}
      >
        {showBackground && (
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
        )}
        <GraphControls layoutMode={settings.layout.mode} onLayoutModeChange={onLayoutModeChange} />
      </ReactFlow>
    </div>
  );
}

export function TrailGraph(props: TrailGraphProps) {
  return (
    <ReactFlowProvider>
      <TrailGraphInner {...props} />
    </ReactFlowProvider>
  );
}
