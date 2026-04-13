import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  SelectionMode,
  useReactFlow,
  useStore,
  applyNodeChanges,
  type NodeMouseHandler,
  type NodeChange,
  type ReactFlowState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TrailGraphProps, TrailNode as TrailNodeType } from "../types.js";
import { TrailNode } from "./TrailNode.js";
import { GraphControls } from "./GraphControls.js";
import { useGraphLayout } from "../hooks/useGraphLayout.js";
import type { NodeId } from "@shared/types/ids.js";


const nodeTypes = { trail: TrailNode };

// LOD selectors — boolean thresholds avoid re-render on every zoom tick
const selectShowEdges = (s: ReactFlowState) => s.transform[2] >= 0.12;
const selectShowBackground = (s: ReactFlowState) => s.transform[2] >= 0.15;
const EMPTY_EDGES: never[] = [];

const defaultEdgeOptions = {
  type: "default",
  animated: false,
  style: {
    stroke: "var(--border)",
    strokeWidth: 1.5,
  },
} as const;

// ── Helpers ──────────────────────────────────────────────────────

function buildChildrenMap(edges: { source: string; target: string }[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of edges) {
    const list = map.get(e.source);
    if (list) list.push(e.target);
    else map.set(e.source, [e.target]);
  }
  return map;
}

function getDescendantIds(nodeId: string, childrenMap: Map<string, string[]>): string[] {
  const result: string[] = [];
  const stack = [nodeId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const children = childrenMap.get(id);
    if (children) {
      for (const child of children) {
        result.push(child);
        stack.push(child);
      }
    }
  }
  return result;
}

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
    onNodeClick,
    onNodeContextMenu,
    onCollapseToggle,
    onSelectionChange,
    onLayoutModeChange,
  } = props;

  const { fitView, getViewport, setViewport } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const initialFitDone = useRef(false);

  const showEdges = useStore(selectShowEdges);
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
  });

  // Keep a ref to selectedNodeIds for use in the layout sync (avoids stale closure)
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;

  const applySelection = useCallback(
    (nodes: TrailNodeType[]): TrailNodeType[] =>
      nodes.map((n) => {
        const sel = selectedNodeIdsRef.current.has(n.data.nodeId);
        return n.selected === sel ? n : { ...n, selected: sel };
      }),
    [],
  );

  const [displayNodes, setDisplayNodes] = useState(() => applySelection(layout.nodes));

  // Sync layout → local state during render (no useEffect lag)
  const [prevLayoutNodes, setPrevLayoutNodes] = useState(layout.nodes);
  if (layout.nodes !== prevLayoutNodes) {
    setPrevLayoutNodes(layout.nodes);
    setDisplayNodes(applySelection(layout.nodes));
  }

  // Sync external selection changes (Cmd+A, Escape, etc.) → displayNodes
  useEffect(() => {
    setDisplayNodes((nds) => {
      let changed = false;
      const next = nds.map((n) => {
        const shouldBeSelected = selectedNodeIds.has(n.data.nodeId);
        if (n.selected === shouldBeSelected) return n;
        changed = true;
        return { ...n, selected: shouldBeSelected };
      });
      return changed ? next : nds;
    });
  }, [selectedNodeIds]);

  const onNodesChange = useCallback((changes: NodeChange<TrailNodeType>[]) => {
    setDisplayNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Children map for group drag
  const childrenMap = useMemo(() => buildChildrenMap(layout.edges), [layout.edges]);

  // Track drag start positions for group drag
  const dragStartRef = useRef<Map<string, { x: number; y: number }> | null>(null);

  const handleNodeDragStart: NodeMouseHandler<TrailNodeType> = useCallback(
    (_event, node) => {
      const descendants = getDescendantIds(node.id, childrenMap);
      if (descendants.length === 0) return;

      const descendantSet = new Set(descendants);
      const posMap = new Map<string, { x: number; y: number }>();
      posMap.set(node.id, { ...node.position });

      setDisplayNodes((nds) => {
        for (const n of nds) {
          if (descendantSet.has(n.id)) {
            posMap.set(n.id, { ...n.position });
          }
        }
        return nds;
      });

      dragStartRef.current = posMap;
    },
    [childrenMap],
  );

  const handleNodeDrag: NodeMouseHandler<TrailNodeType> = useCallback(
    (event, node) => {
      if (event.altKey || !dragStartRef.current) return;

      const startPos = dragStartRef.current.get(node.id);
      if (!startPos) return;

      const dx = node.position.x - startPos.x;
      const dy = node.position.y - startPos.y;

      setDisplayNodes((nds) =>
        nds.map((n) => {
          const initial = dragStartRef.current?.get(n.id);
          // Skip nodes already moved by ReactFlow's multi-selection drag
          if (initial && n.id !== node.id && !n.selected) {
            return { ...n, position: { x: initial.x + dx, y: initial.y + dy } };
          }
          return n;
        }),
      );
    },
    [],
  );

  const handleNodeDragStop: NodeMouseHandler<TrailNodeType> = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  // Cmd/Ctrl+scroll zoom (capture phase to intercept before React Flow)
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

      // Zoom toward cursor position
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const scale = newZoom / vp.zoom;
      const newX = mouseX - (mouseX - vp.x) * scale;
      const newY = mouseY - (mouseY - vp.y) * scale;

      setViewport({ x: newX, y: newY, zoom: newZoom });
    };

    el.addEventListener("wheel", handler, { capture: true, passive: false });
    return () => el.removeEventListener("wheel", handler, { capture: true } as EventListenerOptions);
  }, [getViewport, setViewport]);

  // fitView once on first data
  useEffect(() => {
    if (displayNodes.length > 0 && !initialFitDone.current) {
      initialFitDone.current = true;
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
    }
  }, [displayNodes.length, fitView]);

  // fitView on panel resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      fitView({ padding: 0.2, duration: 200 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitView]);


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
    <div ref={containerRef} className="flex-1 min-h-0 w-full">
      <ReactFlow
        nodes={displayNodes}
        edges={showEdges ? layout.edges : EMPTY_EDGES}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onNodeDoubleClick={handleNodeDoubleClick}
        onSelectionChange={handleSelectionChange}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
        onlyRenderVisibleElements
        nodesDraggable
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
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--border)"
          />
        )}
        <GraphControls
          layoutMode={settings.layout.mode}
          onLayoutModeChange={onLayoutModeChange}
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
