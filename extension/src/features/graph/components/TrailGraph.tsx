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
import { useLatest } from "@ui/hooks/use-latest";

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
  const { getZoom } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const initialFitDone = useRef(false);
  // Marker for distinguishing extension clicks from external navigation:
  // handleNodeClick sets this before onNodeClick runs; when the subsequent
  // currentNodeId change matches, we know the user clicked a node in the
  // extension (rather than navigating externally via the browser).
  const expectedClickNodeId = useRef<NodeId | null>(null);
  // Last `currentNodeId` we've already resolved (centered on or explicitly
  // skipped). Prevents re-centering when the layout array identity churns
  // but the target stays the same, while still allowing us to wait until
  // the async layout produces a position for a freshly-arrived node.
  const resolvedForIdRef = useRef<NodeId | null>(null);
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

  const hasNodes = displayNodes.length > 0;

  // Target position for `currentNodeId` — null while the async layout
  // pipeline hasn't produced a position for it yet (e.g. brand-new tab).
  // Primitive x/y deps below mean the centering effect refires exactly
  // once when the position lands, not on every re-render.
  const targetPos = useMemo(() => {
    if (!currentNodeId) return null;
    const node = displayNodes.find((n) => n.data.nodeId === currentNodeId);
    return node?.position ?? null;
  }, [displayNodes, currentNodeId]);
  const targetX = targetPos?.x ?? null;
  const targetY = targetPos?.y ?? null;

  // Mutable values the centering effect reads but must NOT re-fire on.
  // `smoothCenter`/`smoothFitView` identities churn while a ReactFlow
  // transition is in flight (useReactFlow returns a new object per RAF
  // tick during the tween). Depending on them here would re-schedule the
  // effect every frame → new smoothCenter call → new tween → infinite
  // loop. Read the latest via a ref bundle and fire only when the
  // user-visible trigger (`currentNodeId`, `targetX`/`targetY`) changes.
  const latest = useLatest({
    smoothCenter,
    smoothFitView,
    followClickEnabled,
  });

  // Camera centering policy:
  //   1. Initial mount (sidepanel opens) — always center on the current
  //      node, or fitView if there's no current node.
  //   2. Subsequent external navigation (browser-initiated: user clicks a
  //      link on a page, opens a new tab, or the tab navigates itself) —
  //      always center on the new current node.
  //   3. Subsequent extension-initiated click — only center if the
  //      `camera_follow_click` flag is on. Extension click is detected
  //      via `expectedClickNodeId` matching the new `currentNodeId`.
  //
  // Position may be null on first run after a new node arrives because
  // `useGraphLayout` computes positions asynchronously. The effect simply
  // waits: when `targetX`/`targetY` transition from null → numbers, it
  // re-fires with the newly-available coordinates and centers. The
  // `resolvedForIdRef` guard ensures one commit per `currentNodeId`
  // change, so churn in `displayNodes` (e.g. from selection changes)
  // doesn't trigger repeated re-centers.
  useEffect(() => {
    if (!hasNodes) return;
    const { smoothCenter, smoothFitView, followClickEnabled } = latest.current;

    if (!currentNodeId) {
      // User closed the current tab or we're between tabs. Clear the
      // "resolved" marker so if the user lands back on the same node id
      // later, we re-center instead of short-circuiting.
      resolvedForIdRef.current = null;
      if (!initialFitDone.current) {
        initialFitDone.current = true;
        smoothFitView();
      }
      return;
    }

    if (resolvedForIdRef.current === currentNodeId) return;

    if (targetX === null || targetY === null) {
      // Position not computed yet. On first mount, show the whole graph
      // while we wait so the viewport isn't stuck on an empty region.
      if (!initialFitDone.current) {
        initialFitDone.current = true;
        smoothFitView();
      }
      return;
    }

    const wasClicked = expectedClickNodeId.current === currentNodeId;
    expectedClickNodeId.current = null;
    resolvedForIdRef.current = currentNodeId;

    const isInitial = !initialFitDone.current;
    initialFitDone.current = true;

    const shouldCenter = isInitial || !wasClicked || followClickEnabled;
    if (shouldCenter) {
      smoothCenter(targetX + NODE_WIDTH / 2, targetY + NODE_HEIGHT / 2);
    }
  }, [currentNodeId, hasNodes, targetX, targetY, latest]);

  // Explicit "center on current node" action from the toolbar. Unlike
  // auto-centering on navigation, this preserves the user's current
  // zoom — they explicitly asked "pan to my tab", not "reset my view".
  const handleCenterCurrent = useCallback(() => {
    if (targetX === null || targetY === null) return;
    smoothCenter(targetX + NODE_WIDTH / 2, targetY + NODE_HEIGHT / 2, {
      zoom: getZoom(),
    });
  }, [targetX, targetY, smoothCenter, getZoom]);
  const canCenterCurrent = targetX !== null && targetY !== null;

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
        <GraphControls
          layoutMode={settings.layout.mode}
          onLayoutModeChange={onLayoutModeChange}
          onCenterCurrent={handleCenterCurrent}
          canCenterCurrent={canCenterCurrent}
        />
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
