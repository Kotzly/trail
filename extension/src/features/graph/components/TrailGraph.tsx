import { useCallback, useEffect, useMemo, useRef } from "react";
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
import type { TrailGraphProps, TrailNode as TrailNodeType } from "../types.js";
import { TrailNode } from "./TrailNode.js";
import { GraphControls } from "./GraphControls.js";
import { LodController } from "./LodController.js";
import { useGraphLayout } from "../hooks/useGraphLayout.js";
import { useCmdWheelZoom } from "../hooks/useCmdWheelZoom.js";
import { NODE_WIDTH, NODE_HEIGHT } from "../tree-layout.js";
import type { NodeId } from "@shared/types/ids.js";
import { cn } from "@ui/lib/utils";
import { selectShowBackground } from "../lod.js";
import { useRelayoutEnabled } from "../motion/useRelayoutEnabled.js";
import { useHoverHighlightEnabled } from "../motion/useHoverHighlightEnabled.js";
import { useCameraControls } from "../motion/useCameraControls.js";
import { useMotionFlag } from "../motion/store.js";

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

  const { smoothCenter, smoothFitView } = useCameraControls();
  const containerRef = useRef<HTMLDivElement>(null);
  const initialFitDone = useRef(false);
  // Marker for distinguishing extension clicks from external navigation:
  // handleNodeClick sets this before onNodeClick runs; when the subsequent
  // currentNodeId change matches, we know the user clicked a node in the
  // extension (rather than navigating externally via the browser).
  const expectedClickNodeId = useRef<NodeId | null>(null);
  const followClickEnabled = useMotionFlag("camera_follow_click");

  useCmdWheelZoom(containerRef);

  const showBackground = useStore(selectShowBackground);
  const relayoutAnimated = useRelayoutEnabled();
  const hoverGlow = useHoverHighlightEnabled();

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

  const currentNode = useMemo(
    () => (currentNodeId ? displayNodes.find((n) => n.data.nodeId === currentNodeId) : undefined),
    [currentNodeId, displayNodes],
  );

  // Camera centering policy:
  //   1. Initial mount (sidepanel opens) — always center on current node, or
  //      fitView if there's no current node.
  //   2. Subsequent external navigation (browser-initiated, user clicks a
  //      link on a page) — always center on the new current node.
  //   3. Subsequent extension-initiated click — only center if the
  //      `camera_follow_click` flag is on. Extension click is detected via
  //      `expectedClickNodeId` matching the new `currentNodeId`.
  //
  // `displayNodes.length` is a cheap proxy for "layout computed"; we depend
  // on the array reference via `currentNode` so the effect re-runs when the
  // node's position actually changes.
  useEffect(() => {
    if (displayNodes.length === 0) return;

    if (!currentNode?.position) {
      // No current node yet — fit view on initial mount, then stop.
      if (!initialFitDone.current) {
        initialFitDone.current = true;
        smoothFitView();
      }
      return;
    }

    const wasClicked =
      expectedClickNodeId.current !== null && expectedClickNodeId.current === currentNodeId;
    if (wasClicked) expectedClickNodeId.current = null;

    const isInitial = !initialFitDone.current;
    const shouldCenter = isInitial || !wasClicked || followClickEnabled;
    if (!shouldCenter) return;

    initialFitDone.current = true;
    smoothCenter(currentNode.position.x + NODE_WIDTH / 2, currentNode.position.y + NODE_HEIGHT / 2);
  }, [
    currentNode,
    currentNodeId,
    displayNodes.length,
    smoothCenter,
    smoothFitView,
    followClickEnabled,
  ]);

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
        // Mark this click so the centering effect can tell extension-initiated
        // navigation from external browser navigation. When the tab update
        // lands and currentNodeId matches this ref, we know the user clicked.
        expectedClickNodeId.current = data.nodeId;
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
    <div
      ref={containerRef}
      className={cn(
        "min-h-0 w-full flex-1",
        relayoutAnimated && "graph--relayout-animated",
        hoverGlow && "graph--hover-glow",
      )}
    >
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
        <LodController targetRef={containerRef} />
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
