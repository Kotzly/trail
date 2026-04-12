import { useCallback, useMemo, useRef, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useReactFlow,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TrailGraphProps } from "../types.js";
import { TrailNode } from "./TrailNode.js";
import { GraphControls } from "./GraphControls.js";
import { useGraphLayout } from "../hooks/useGraphLayout.js";
import type { NodeId } from "@shared/types/ids.js";


const nodeTypes = { trail: TrailNode };

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

  const { nodes, edges } = useGraphLayout({
    tree,
    settings,
    collapsedNodeIds,
    metadata,
  });

  // fitView once on first data
  useEffect(() => {
    if (nodes.length > 0 && !initialFitDone.current) {
      initialFitDone.current = true;
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
    }
  }, [nodes.length, fitView]);

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
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
