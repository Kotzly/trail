import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useReactFlow,
  applyNodeChanges,
  type NodeMouseHandler,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TrailGraphProps, TrailNode as TrailNodeType } from "../types.js";
import { TrailNode } from "./TrailNode.js";
import { GraphControls } from "./GraphControls.js";
import { useGraphLayout } from "../hooks/useGraphLayout.js";
import type { NodeId } from "@shared/types/ids.js";


const nodeTypes = { trail: TrailNode };

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
    nodeTabCounts,
    settings,
    onNodeClick,
    onNodeContextMenu,
    onCollapseToggle,
    onLayoutModeChange,
  } = props;

  const { fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const initialFitDone = useRef(false);

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

  const [displayNodes, setDisplayNodes] = useState<TrailNodeType[]>([]);

  // Sync layout → local state
  useEffect(() => {
    setDisplayNodes(layout.nodes);
  }, [layout.nodes]);

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

      const posMap = new Map<string, { x: number; y: number }>();
      posMap.set(node.id, { ...node.position });

      setDisplayNodes((nds) => {
        for (const n of nds) {
          if (descendants.includes(n.id)) {
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
          if (initial && n.id !== node.id) {
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


  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
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
        edges={layout.edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodesDraggable
        nodesConnectable={false}
        connectOnClick={false}
        panOnScroll
        panOnScrollSpeed={1}
        zoomOnScroll={false}
        zoomOnPinch
        zoomActivationKeyCode="Meta"
        fitView={false}
        minZoom={0.05}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "default",
          animated: false,
          style: {
            stroke: "var(--border)",
            strokeWidth: 1.5,
          },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--border)"
        />
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
