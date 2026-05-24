"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SharedTrailNode } from "@/lib/shared-trail-types";
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  computeTreePositions,
  flattenForGraph,
} from "./tree-layout";

const proOptions = { hideAttribution: true } as const;

/**
 * Read-only graph view for `/s/<code>`. Mirrors the extension's
 * Reingold-Tilford tree layout (top-down) without any of the
 * interaction surface — no drag, no inline rename, no selection,
 * no LOD, no camera centering. Mode: panning + zoom only. Imports
 * happen via the existing extension-bridge button above the canvas.
 *
 * The canvas height is fixed so the share page never grows past one
 * viewport, addressing the prior tree view's pathological vertical
 * scroll on large trails. Users can pan/zoom to explore.
 */
export function SharedTrailGraph({ root }: { root: SharedTrailNode }) {
  return (
    <ReactFlowProvider>
      <SharedTrailGraphInner root={root} />
    </ReactFlowProvider>
  );
}

function SharedTrailGraphInner({ root }: { root: SharedTrailNode }) {
  const { nodes, edges } = useMemo(() => buildGraph(root), [root]);
  const nodeTypes = useMemo(() => ({ trail: TrailGraphNode }), []);

  return (
    <div className="relative h-[640px] w-full overflow-hidden rounded-lg border bg-card">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        proOptions={proOptions}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable
        panOnScroll
        zoomOnPinch
        zoomOnScroll={false}
        minZoom={0.2}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "default",
          style: { stroke: "var(--border)", strokeWidth: 1.5 },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--border)"
        />
      </ReactFlow>
      <p className="pointer-events-none absolute bottom-2 right-3 text-[10px] uppercase tracking-wide text-muted-foreground">
        Drag to pan · pinch / Ctrl-scroll to zoom
      </p>
    </div>
  );
}

type TrailNodeData = {
  title: string;
  host: string | null;
  url: string;
  isLeaf: boolean;
  isRoot: boolean;
};

/**
 * Read-only graph node. Deliberately does NOT fetch favicons: shared
 * snapshots strip favicon URLs at mint time (see the sharing sanitizer,
 * premortem #14.1 — hotlinked favicons are a tracker-pixel vector), and
 * fetching them client-side from a third party would leak every shared
 * domain to that service. Instead we render a neutral monogram derived
 * from the host's first letter — zero network, no leak.
 */
function TrailGraphNode({ data }: NodeProps<Node<TrailNodeData>>) {
  const monogram = (data.host?.replace(/^www\./, "")[0] ?? "·").toUpperCase();
  return (
    <div
      className="group flex h-full w-full flex-col gap-1 rounded-md border bg-background px-3 py-2 text-left shadow-sm transition-colors hover:bg-muted/40"
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
    >
      {!data.isRoot ? (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-0 !w-0 !border-0 !bg-transparent"
          isConnectable={false}
        />
      ) : null}
      <a
        href={data.url || "#"}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="flex items-center gap-2 text-xs font-medium leading-tight"
        title={data.title}
      >
        <span
          className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted text-[9px] font-semibold text-muted-foreground"
          aria-hidden
        >
          {monogram}
        </span>
        <span className="line-clamp-2 break-words text-foreground group-hover:underline">
          {data.title}
        </span>
      </a>
      {data.host ? (
        <span className="truncate text-[10px] text-muted-foreground">
          {data.host}
        </span>
      ) : null}
      {!data.isLeaf ? (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-0 !w-0 !border-0 !bg-transparent"
          isConnectable={false}
        />
      ) : null}
    </div>
  );
}

function buildGraph(root: SharedTrailNode): {
  nodes: Node<TrailNodeData>[];
  edges: Edge[];
} {
  const positions = computeTreePositions(root);
  const { flat } = flattenForGraph(root);
  const nodes: Node<TrailNodeData>[] = [];
  const edges: Edge[] = [];
  for (const { node, parentId } of flat) {
    const position = positions.get(node.id) ?? { x: 0, y: 0 };
    const isLeaf = node.children.length === 0;
    const isRoot = parentId === null;
    nodes.push({
      id: node.id,
      type: "trail",
      position,
      data: {
        title: node.data.title || node.data.url || "Untitled",
        url: node.data.url ?? "",
        host: safeHost(node.data.url),
        isLeaf,
        isRoot,
      },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      draggable: false,
      selectable: true,
    });
    if (parentId) {
      edges.push({
        id: `${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
      });
    }
  }
  return { nodes, edges };
}

function safeHost(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
