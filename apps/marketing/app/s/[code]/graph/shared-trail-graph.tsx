"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  useReactFlow,
  useStore,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./share-graph.css";
import { Globe, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import type { SharedTrailNode } from "@/lib/shared-trail-types";
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  computeTreePositions,
  flattenForGraph,
} from "./tree-layout";

const proOptions = { hideAttribution: true } as const;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 1.5;

// LOD thresholds, ported from extension/src/features/graph/lod.ts. The
// selectors return a bucket / boolean so subscribers re-render only when
// the value flips, never per zoom frame.
const ZOOM_LABELS = 0.15;
const ZOOM_DETAIL = 0.4;
type Lod = "far" | "mid" | "near";
const selectLod = (s: ReactFlowState): Lod => {
  const zoom = s.transform[2];
  if (zoom < ZOOM_LABELS) return "far";
  if (zoom < ZOOM_DETAIL) return "mid";
  return "near";
};
const selectShowBackground = (s: ReactFlowState) =>
  s.transform[2] >= ZOOM_LABELS;

const defaultEdgeOptions = {
  type: "default",
  animated: false,
  style: { stroke: "var(--border)", strokeWidth: 1.5 },
} as const;

/**
 * Read-only graph view for `/s/<code>`. Renders the extension's exact node
 * card (see extension/src/features/graph/components/TrailNode.tsx) and its
 * Reingold-Tilford tree layout, minus every interaction surface — no drag,
 * rename, selection, or camera follow. The anti-lag techniques the
 * extension proved out on large trees are ported wholesale: per-node CSS
 * containment, a `share-graph--panning` pointer-events kill so sliding
 * nodes don't each toggle `:hover`, CSS-driven LOD, and an isolated
 * background subscriber (see share-graph.css). Imports happen via the
 * extension-bridge button above the canvas.
 */
export function SharedTrailGraph({
  root,
  currentNodeId,
}: {
  root: SharedTrailNode;
  currentNodeId?: string | null;
}) {
  return (
    <ReactFlowProvider>
      <SharedTrailGraphInner
        root={root}
        currentNodeId={currentNodeId ?? null}
      />
    </ReactFlowProvider>
  );
}

function SharedTrailGraphInner({
  root,
  currentNodeId,
}: {
  root: SharedTrailNode;
  currentNodeId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { nodes, edges } = useMemo(
    () => buildGraph(root, currentNodeId),
    [root, currentNodeId],
  );
  const nodeTypes = useMemo(() => ({ trail: TrailGraphNode }), []);

  useCmdWheelZoom(containerRef);

  // Panning kill — see share-graph.css. xyflow debounces the move-end by
  // ~150ms internally, so flipping straight off on onMoveEnd keeps clicks
  // responsive immediately after a pan.
  const [isPanning, setIsPanning] = useState(false);
  const handleMoveStart = useCallback(() => setIsPanning(true), []);
  const handleMoveEnd = useCallback(() => setIsPanning(false), []);

  return (
    <div
      ref={containerRef}
      className={cn(
        // Canvas sits on the page background (darker than `--card`) so the
        // cards inside pop, exactly like the extension's panel. Using
        // `bg-card` here would match the cards' own fill → no contrast.
        "relative h-[640px] w-full overflow-hidden rounded-lg border bg-background",
        isPanning && "share-graph--panning",
      )}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        proOptions={proOptions}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        onMoveStart={handleMoveStart}
        onMoveEnd={handleMoveEnd}
        // Embedded in a scrollable page: drag to pan, Cmd/Ctrl-scroll or
        // pinch to zoom (useCmdWheelZoom). A bare wheel scrolls the page,
        // never hijacked into the canvas — matches the help text below.
        panOnDrag
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
      >
        <GraphBackground />
        <LodSync targetRef={containerRef} />
      </ReactFlow>
      <p className="pointer-events-none absolute right-3 bottom-2 text-[10px] tracking-wide text-muted-foreground uppercase">
        Drag to pan · pinch / Ctrl-scroll to zoom
      </p>
    </div>
  );
}

/**
 * Isolated background subscriber. Keeping the `useStore` read in a leaf
 * means the parent doesn't re-render when zoom crosses the background
 * threshold. Hides the dot grid at far zoom (extension parity).
 */
function GraphBackground() {
  const show = useStore(selectShowBackground);
  if (!show) return null;
  return (
    <Background
      variant={BackgroundVariant.Dots}
      gap={20}
      size={1}
      color="var(--border)"
    />
  );
}

/**
 * Projects the zoom level onto a `data-lod` attribute on the container so
 * share-graph.css can gate node chrome without a per-node subscription.
 * Re-renders at most twice per zoom gesture (selectLod only flips on a
 * threshold crossing).
 */
function LodSync({
  targetRef,
}: {
  targetRef: React.RefObject<HTMLElement | null>;
}): null {
  const lod = useStore(selectLod);
  useEffect(() => {
    targetRef.current?.setAttribute("data-lod", lod);
  }, [lod, targetRef]);
  return null;
}

/**
 * Cursor-anchored zoom on Cmd/Ctrl+wheel and trackpad pinch (which arrives
 * as a wheel event with synthetic ctrlKey). Ported from the extension's
 * useCmdWheelZoom; `getViewport`/`setViewport` from useReactFlow are stable
 * so the listener mounts once. `passive: false` is required to
 * conditionally preventDefault.
 */
function useCmdWheelZoom(
  containerRef: React.RefObject<HTMLElement | null>,
): void {
  const { getViewport, setViewport } = useReactFlow();
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      const vp = getViewport();
      const clamped = Math.max(-30, Math.min(30, event.deltaY));
      const factor = 1 - clamped * 0.006;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * factor));
      const rect = el.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const scale = newZoom / vp.zoom;
      setViewport({
        x: mouseX - (mouseX - vp.x) * scale,
        y: mouseY - (mouseY - vp.y) * scale,
        zoom: newZoom,
      });
    };
    el.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () =>
      el.removeEventListener("wheel", onWheel, {
        capture: true,
      } as EventListenerOptions);
  }, [containerRef, getViewport, setViewport]);
}

type TrailNodeData = {
  title: string;
  url: string;
  displayUrl: string;
  pinned: boolean;
  isLeaf: boolean;
  isRoot: boolean;
  isCurrent: boolean;
};

const hiddenHandle = { opacity: 0, width: 6, height: 6 } as const;

/**
 * Read-only mirror of the extension's TrailNode. Deliberately does NOT
 * fetch favicons: shared snapshots strip favicon URLs at mint time (a
 * hotlinked favicon is a tracker-pixel vector), so we render the same
 * neutral Globe the extension shows for favicon-less nodes — zero network,
 * no domain leak. The current node (at snapshot time) carries the primary
 * ring exactly like the live graph.
 */
function TrailGraphNode({ data }: NodeProps<Node<TrailNodeData>>) {
  return (
    <>
      {!data.isRoot ? (
        <Handle
          type="target"
          position={Position.Top}
          style={hiddenHandle}
          isConnectable={false}
        />
      ) : null}
      <Card
        size="default"
        data-trail-card
        className={cn(
          "relative flex min-h-[60px] w-[160px] flex-row items-center gap-2 px-2.5 py-2",
          "cursor-default select-none",
          "transition-[transform,box-shadow,background-color] duration-150 ease-out",
          "hover:scale-[1.015] hover:shadow-md",
          "active:scale-[0.985]",
          data.isCurrent && "ring-primary shadow-primary/25 shadow-sm",
        )}
      >
        <span
          data-lod-detail
          className="flex size-4 shrink-0 items-center justify-center"
        >
          <Globe
            className="size-4 shrink-0 text-muted-foreground/60"
            strokeWidth={1.75}
            aria-hidden
          />
        </span>
        <div data-lod-title className="flex min-w-0 flex-1 flex-col gap-0.5">
          <a
            href={data.url || "#"}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="line-clamp-2 text-xs leading-tight font-medium hover:underline"
            title={data.title}
          >
            {data.title}
          </a>
          {data.displayUrl ? (
            <span
              data-lod-detail
              className="truncate text-[6px] leading-tight text-muted-foreground"
            >
              {data.displayUrl}
            </span>
          ) : null}
        </div>
        {data.pinned ? (
          <div
            data-lod-detail
            className="flex shrink-0 flex-col items-end gap-0.5"
          >
            <Badge
              variant="outline"
              aria-label="Pinned"
              className="h-4 rounded border-transparent px-0.5 text-muted-foreground"
            >
              <Pin className="size-2.5" aria-hidden />
            </Badge>
          </div>
        ) : null}
      </Card>
      {!data.isLeaf ? (
        <Handle
          type="source"
          position={Position.Bottom}
          style={hiddenHandle}
          isConnectable={false}
        />
      ) : null}
    </>
  );
}

function buildGraph(
  root: SharedTrailNode,
  currentNodeId: string | null,
): { nodes: Node<TrailNodeData>[]; edges: Edge[] } {
  const positions = computeTreePositions(root);
  const { flat } = flattenForGraph(root);
  const nodes: Node<TrailNodeData>[] = [];
  const edges: Edge[] = [];
  for (const { node, parentId } of flat) {
    const position = positions.get(node.id) ?? { x: 0, y: 0 };
    const title = node.data.title || displayUrlFor(node.data.url) || "Untitled";
    nodes.push({
      id: node.id,
      type: "trail",
      position,
      data: {
        title,
        url: node.data.url ?? "",
        displayUrl: displayUrlFor(node.data.url),
        pinned: Boolean(node.data.pinned),
        isLeaf: node.children.length === 0,
        isRoot: parentId === null,
        isCurrent: currentNodeId !== null && node.id === currentNodeId,
      },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      draggable: false,
      selectable: false,
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

/**
 * Strip protocol / www / trailing slash for the sub-title URL line — the
 * exact transform the extension's TrailNode applies.
 */
function displayUrlFor(url: string | undefined | null): string {
  if (!url) return "";
  return String(url)
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "");
}
