import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  SelectionMode,
  useReactFlow,
  useStore,
  type NodeChange,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../motion/relayout.css";
import "../motion/hover.css";
import "../motion/lifecycle.css";
import "../pane.css";
import type { TrailGraphProps, TrailNode as TrailNodeType, TrailNodeData } from "../types.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import { TrailNode } from "./TrailNode.js";
import { InlineRenameProvider } from "./inline-rename-context.js";
import { buildTreeMaps, isValidDropTarget } from "../reparent.js";
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
import { useNodeLifecycle, useNodeLifecycleEnabled } from "../motion/useNodeLifecycle.js";
import { useCameraControls } from "../motion/useCameraControls.js";
import { useMotionFlag } from "../motion/store.js";
import { useLatest } from "@ui/hooks/use-latest";

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

  const { smoothCenter } = useCameraControls();
  const { getZoom, getIntersectingNodes } = useReactFlow();
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

  // ── Drag-to-reparent ─────────────────────────────────────────────
  // Two slices of state, deliberately separated by update frequency:
  //
  //   • `dragState` (source + hovered + valid?) drives the validity
  //     ring on the source / hovered targets. Flips only on
  //     target-enter/exit — once or twice per drag.
  //
  //   • `dragPosition` mirrors the dragged node's live cursor
  //     position in flow-space. Updated on every `onNodesChange`
  //     tick (60–120Hz). In xyflow v12 controlled mode the rendered
  //     node position comes from the `nodes` prop — without a state
  //     update, the dragged node would stay glued at its layout
  //     position AND its incident edges would freeze (edge endpoints
  //     resolve through xyflow's internal nodeInternals, which only
  //     advances when the controlled `nodes` prop changes).
  //
  // The previous "imperative DOM via CSS variable" hack moved the
  // node visually but left nodeInternals stale, so edges didn't
  // follow. The earlier "round-trip through React state" attempt
  // before that put `dragOverride` inside `displayNodes`'s deps —
  // forcing a full-tree map + a `useNodeLifecycle` pass per cursor
  // tick (~5000 × 2 iterations) — and that's where the 30–50ms
  // perceived lag came from, not React state itself.
  //
  // Fix: keep `dragPosition` OUT of `displayNodes`/`lifecycleNodes`
  // deps. Apply the override in a single downstream memo
  // (`finalNodes`) — one O(N) pass per tick where only the dragged
  // node gets a new object reference, everything else passes through
  // by identity. xyflow's diff updates the dragged node's transform
  // + recomputes incident edge `d` attributes; nothing else moves.
  const [dragState, setDragState] = useState<{
    sourceId: NodeId | null;
    hoveredTargetId: NodeId | null;
    isValidTarget: boolean;
  }>({ sourceId: null, hoveredTargetId: null, isValidTarget: false });
  const [dragPosition, setDragPosition] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  // Parent / root lookup once per tree. Drives the per-frame
  // `isValidDropTarget` check during a drag — same rules the backend
  // enforces, so the user gets instant valid/invalid ring feedback.
  const treeMaps = useMemo(() => buildTreeMaps(tree), [tree]);

  // Initial-mount focus when there's no active tab (or its position
  // hasn't landed yet): prefer the most-recently-visited node, fall back
  // to root. Replaces the old "fitView the whole graph" default — that
  // is now reserved for the explicit user action (GraphControls button).
  const fallbackFocusId = useMemo<NodeId | null>(() => {
    if (!tree?.root) return null;
    let bestId: NodeId = tree.root.id;
    let bestTs = 0;
    const walk = (n: NavigationNodeJSON) => {
      const ts = n.data.lastVisitedAt;
      if (ts !== undefined && ts > bestTs) {
        bestTs = ts;
        bestId = n.id;
      }
      for (const c of n.children) walk(c);
    };
    walk(tree.root);
    return bestId;
  }, [tree]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type !== "position" || !change.dragging || !change.position) continue;
      const { id } = change;
      const { x, y } = change.position;
      setDragPosition((prev) =>
        prev && prev.id === id && prev.x === x && prev.y === y ? prev : { id, x, y },
      );
    }
  }, []);

  const handleNodeDragStart: NodeMouseHandler = useCallback(
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

  const handleNodeDrag: NodeMouseHandler = useCallback(
    (_event, node) => {
      const sourceId = (node.data as TrailNodeData).nodeId;
      // `partial=true` — accept any overlap, not just full containment.
      // With nodes the same size, a dragged node almost never sits
      // entirely *inside* another one, so `false` would mean "no target
      // ever lights up." When several nodes overlap, prefer the one
      // whose center is closest to the dragged node's center (all coords
      // in flow-space, so the comparison is consistent).
      const intersecting = getIntersectingNodes(node, true).filter((n) => n.id !== node.id);
      if (intersecting.length === 0) {
        setDragState((prev) =>
          prev.hoveredTargetId === null && prev.sourceId === sourceId
            ? prev
            : { sourceId, hoveredTargetId: null, isValidTarget: false },
        );
        return;
      }
      const sourceW = node.measured?.width ?? node.width ?? NODE_WIDTH;
      const sourceH = node.measured?.height ?? node.height ?? NODE_HEIGHT;
      const sourceCx = node.position.x + sourceW / 2;
      const sourceCy = node.position.y + sourceH / 2;
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
    },
    [getIntersectingNodes, treeMaps],
  );

  const handleNodeDragStop: NodeMouseHandler = useCallback(
    (_event, node) => {
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

  const dragSourceId = dragState.sourceId;
  const dragHoveredId = dragState.hoveredTargetId;
  const dragValid = dragState.isValidTarget;

  const rootId = treeMaps.rootId;

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

  // Apply the live drag position as the final layer — kept outside the
  // upstream memos so a 60–120Hz pointermove tick triggers only this
  // single O(N) pass. Only the dragged node gets a new object
  // reference; every other node passes through by identity, so
  // xyflow's internal diff updates the one moved node + recomputes
  // only its incident edges.
  const finalNodes = useMemo(() => {
    if (!dragPosition) return lifecycleNodes;
    const { id, x, y } = dragPosition;
    return lifecycleNodes.map((n) => (n.id === id ? { ...n, position: { x, y } } : n));
  }, [lifecycleNodes, dragPosition]);

  const hasNodes = finalNodes.length > 0;

  // Target position for `currentNodeId` — null when the node hasn't
  // reached the layout yet (e.g. brand-new tab that arrives just before
  // the geometry memo recomputes). Primitive x/y deps below mean the
  // centering effect refires exactly once when the position lands, not
  // on every re-render.
  const targetPos = useMemo(() => {
    if (!currentNodeId) return null;
    const node = displayNodes.find((n) => n.data.nodeId === currentNodeId);
    return node?.position ?? null;
  }, [displayNodes, currentNodeId]);
  const targetX = targetPos?.x ?? null;
  const targetY = targetPos?.y ?? null;

  // Position of the initial-mount fallback (last-visited or root). Looked
  // up once per displayNodes/fallbackFocusId change so the centering
  // effect can read primitive deps and not refire on every render.
  const fallbackPos = useMemo(() => {
    if (!fallbackFocusId) return null;
    const node = displayNodes.find((n) => n.data.nodeId === fallbackFocusId);
    return node?.position ?? null;
  }, [displayNodes, fallbackFocusId]);
  const fallbackX = fallbackPos?.x ?? null;
  const fallbackY = fallbackPos?.y ?? null;

  // Mutable values the centering effect reads but must NOT re-fire on.
  // `smoothCenter`'s identity churns while a ReactFlow transition is in
  // flight (useReactFlow returns a new object per RAF tick during the
  // tween). Depending on it here would re-schedule the effect every
  // frame → new smoothCenter call → new tween → infinite loop. Read the
  // latest via a ref bundle and fire only when the user-visible trigger
  // (`currentNodeId`, `targetX`/`targetY`, fallback coords) changes.
  const latest = useLatest({
    smoothCenter,
    followClickEnabled,
  });

  // Layout mode switch (Tree ↔ Map) drastically reshuffles positions.
  // Reset the resolved marker so the centering effect below re-fires
  // when the new geometry lands and tweens to the current node. Runs
  // before the centering effect by declaration order; on initial mount
  // the reset is a no-op (ref is already null).
  useEffect(() => {
    resolvedForIdRef.current = null;
  }, [settings.layout.mode]);

  // Camera centering policy:
  //   1. Initial mount (sidepanel opens) — center on the current node,
  //      or on the fallback focus (last-visited, else root) when there's
  //      no current tab or its position hasn't landed yet. Auto-fitView
  //      was removed — full-graph framing is a user-only action via the
  //      GraphControls button.
  //   2. Subsequent external navigation (browser-initiated: user clicks a
  //      link on a page, opens a new tab, or the tab navigates itself) —
  //      always center on the new current node.
  //   3. Subsequent extension-initiated click — only center if the
  //      `camera_follow_click` flag is on. Extension click is detected
  //      via `expectedClickNodeId` matching the new `currentNodeId`.
  //   4. Layout mode switch — re-center on current node (see effect above).
  //
  // Position may be null on the very first pass for a new node (tree
  // update arrives before the geometry memo recomputes). The effect
  // simply waits: when `targetX`/`targetY` transition null → numbers,
  // it re-fires with the newly-available coordinates and centers. The
  // `resolvedForIdRef` guard ensures one commit per `currentNodeId`
  // change, so churn in `displayNodes` (e.g. from selection changes)
  // doesn't trigger repeated re-centers.
  useEffect(() => {
    if (!hasNodes) return;
    const { smoothCenter, followClickEnabled } = latest.current;

    if (!currentNodeId) {
      // User closed the current tab or we're between tabs. Clear the
      // "resolved" marker so if the user lands back on the same node id
      // later, we re-center instead of short-circuiting.
      resolvedForIdRef.current = null;
      if (!initialFitDone.current && fallbackX !== null && fallbackY !== null) {
        initialFitDone.current = true;
        smoothCenter(fallbackX + NODE_WIDTH / 2, fallbackY + NODE_HEIGHT / 2);
      }
      return;
    }

    if (resolvedForIdRef.current === currentNodeId) return;

    if (targetX === null || targetY === null) {
      // Current node's position isn't laid out yet. Park the camera on
      // the fallback so the viewport isn't stuck at xyflow's (0,0)
      // default; when the position lands, the effect re-fires and
      // smoothCenter tweens to the actual current node.
      if (!initialFitDone.current && fallbackX !== null && fallbackY !== null) {
        initialFitDone.current = true;
        smoothCenter(fallbackX + NODE_WIDTH / 2, fallbackY + NODE_HEIGHT / 2);
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
  }, [currentNodeId, hasNodes, targetX, targetY, fallbackX, fallbackY, latest]);

  // ── Topology reshape (collapse / expand / chain-unfold) ───────────
  //
  // When the user toggles a collapse, the layout recomputes and every
  // affected node tweens to its new transform via relayout.css. Two
  // things were missing before:
  //   1. The camera didn't follow — if the user collapsed a wide
  //      branch, content shifted off-screen with no visual continuity.
  //      Now we smoothCenter on the toggled node, preserving zoom, so
  //      the focal point stays anchored while everything morphs around
  //      it (PowerPoint-Morph feel).
  //   2. SVG edges snap-update their `d` attribute to the new geometry
  //      while nodes are still tweening to it — edges visibly
  //      disconnect from their endpoints during the 350ms morph. The
  //      `graph--reshaping` class fades edges to ~30% opacity for the
  //      duration of the morph; once the nodes have settled, edges
  //      fade back in already drawn at their final positions.
  const [isReshaping, setIsReshaping] = useState(false);
  const reshapeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!collapseAction) return;
    if (collapseAction.nodeIds.size === 0) return;

    const firstId = collapseAction.nodeIds.values().next().value as NodeId | undefined;
    if (!firstId) return;

    setIsReshaping(true);
    if (reshapeTimerRef.current !== null) {
      window.clearTimeout(reshapeTimerRef.current);
    }
    reshapeTimerRef.current = window.setTimeout(() => {
      setIsReshaping(false);
      reshapeTimerRef.current = null;
    }, 380);

    // Defer the camera center to the next frame so the layout memo has
    // committed the new positions; reading them earlier would tween
    // toward the OLD position and look broken.
    const handle = window.requestAnimationFrame(() => {
      const { smoothCenter } = latest.current;
      const target = displayNodesRef.current.find((n) => n.data.nodeId === firstId);
      if (!target) return;
      smoothCenter(target.position.x + NODE_WIDTH / 2, target.position.y + NODE_HEIGHT / 2, {
        zoom: getZoom(),
      });
    });

    return () => window.cancelAnimationFrame(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapseAction]);

  useEffect(() => {
    return () => {
      if (reshapeTimerRef.current !== null) {
        window.clearTimeout(reshapeTimerRef.current);
      }
    };
  }, []);

  // ── Pan / camera-move suppression ────────────────────────────────
  //
  // `panOnScroll` keeps the cursor stationary while content slides
  // under it, so during a pan every node sliding past the cursor
  // toggles `:hover`. With many nodes in the viewbox this is N ×
  // (box-shadow + transition + z-index reorder) per frame, which is
  // the dominant pan-lag cost on large trees. The `graph--panning`
  // class kills pointer-events on all nodes for the duration of the
  // move, so :hover never matches.
  //
  // xyflow's panOnScroll handler already debounces the end event by
  // 150ms after the last wheel (see @xyflow/system createPanOnScrollHandler).
  // We flip the flag straight off on onMoveEnd — adding our own
  // debounce on top would extend the dead window for clicks. A click
  // immediately after a pan needs hover/pointer-events back instantly.
  const [isPanning, setIsPanning] = useState(false);

  const handleMoveStart = useCallback(() => {
    setIsPanning(true);
  }, []);

  const handleMoveEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Mirror displayNodes into a ref so the rAF callback above always
  // reads the latest geometry without retriggering the effect.
  const displayNodesRef = useRef(displayNodes);
  displayNodesRef.current = displayNodes;

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

  // ReactFlow unconditionally clears selection at the start of a marquee
  // drag (xyflow `resetSelectedElements` runs regardless of multi-select key),
  // which breaks "hold modifier + drag to change selection". We capture the
  // pre-drag selection on pointerdown and merge the marquee result into it
  // per the mode chosen at pointerdown: add (Shift/Meta/Ctrl) unions the
  // rect with preserved; subtract (Alt/Option) removes rect from preserved.
  const preservedSelection = useRef<Set<NodeId> | null>(null);
  const selectionMode = useRef<"add" | "subtract" | null>(null);
  const marqueeActive = useRef(false);
  const justReset = useRef(false);
  const selectedIdsLatest = useLatest(selectedNodeIds);

  const handleContainerPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      const mode: "add" | "subtract" | null = event.altKey
        ? "subtract"
        : event.shiftKey || event.metaKey || event.ctrlKey
          ? "add"
          : null;
      if (mode) {
        preservedSelection.current = new Set(selectedIdsLatest.current);
        selectionMode.current = mode;
        justReset.current = true;
      } else {
        preservedSelection.current = null;
        selectionMode.current = null;
        justReset.current = false;
      }
    },
    [selectedIdsLatest],
  );

  const handleContainerPointerUp = useCallback(() => {
    if (!marqueeActive.current) {
      preservedSelection.current = null;
      selectionMode.current = null;
      justReset.current = false;
    }
  }, []);

  const handleSelectionStart = useCallback(() => {
    marqueeActive.current = true;
  }, []);

  const handleSelectionEnd = useCallback(() => {
    marqueeActive.current = false;
    preservedSelection.current = null;
    selectionMode.current = null;
    justReset.current = false;
  }, []);

  // Sync ReactFlow selection → store
  const handleSelectionChange = useCallback(
    ({ nodes }: { nodes: TrailNodeType[] }) => {
      const rect = new Set<NodeId>(nodes.map((n) => n.data.nodeId));
      const preserved = preservedSelection.current;
      const mode = selectionMode.current;

      if (!preserved || !mode) {
        onSelectionChange(rect);
        return;
      }

      if (!marqueeActive.current) {
        if (rect.size === 0 && justReset.current) {
          // xyflow's reset at marquee start fired before onSelectionStart.
          // Restore pre-drag selection so there's no empty flash.
          justReset.current = false;
          onSelectionChange(new Set(preserved));
          return;
        }
        // Non-empty without marquee → click path (handled by xyflow).
        justReset.current = false;
        onSelectionChange(rect);
        return;
      }

      const merged = new Set(preserved);
      if (mode === "add") {
        for (const id of rect) merged.add(id);
      } else {
        for (const id of rect) merged.delete(id);
      }
      onSelectionChange(merged);
    },
    [onSelectionChange],
  );

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
        // lands and currentNodeId matches this ref, we know the user clicked.
        expectedClickNodeId.current = data.nodeId;
        onNodeClick(data.nodeId, String(data.url));
      }
    },
    [onNodeClick, onChainUnfoldToggle, onBadgeCollapseToggle],
  );

  // Clicking empty pane clears multi-selection — feels like every other
  // canvas tool. With `selectionOnDrag` on, ReactFlow treats pane drags
  // as marquee starts; a click without drag fires `onPaneClick` and we
  // wipe the selection. Single node clicks already collapse selection
  // to that node via ReactFlow's internal handling, so no extra work
  // needed there. Escape mirrors the same gesture for keyboard users.
  const handlePaneClick = useCallback(() => {
    if (selectedNodeIds.size > 0) onSelectionChange(new Set());
  }, [selectedNodeIds, onSelectionChange]);

  useEffect(() => {
    if (selectedNodeIds.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        preservedSelection.current = null;
        selectionMode.current = null;
        marqueeActive.current = false;
        justReset.current = false;
        onSelectionChange(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        onPointerDownCapture={handleContainerPointerDown}
        onPointerUpCapture={handleContainerPointerUp}
      >
        <ReactFlow
          nodes={finalNodes}
          edges={layout.edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          onNodeContextMenu={handleNodeContextMenu}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodesChange={handleNodesChange}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={handlePaneClick}
          onSelectionChange={handleSelectionChange}
          onSelectionStart={handleSelectionStart}
          onSelectionEnd={handleSelectionEnd}
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
          // `onlyRenderVisibleElements` ON. Previously OFF because the
          // viewport-cull mounted/unmounted nodes at the edge and each
          // mount fired TrailNode's `useUpdateNodeInternals` → xyflow
          // store set({}) → woke every useStore subscriber, amplifying
          // pan to N×bail-out work.
          //
          // That cascade is now defanged at the source:
          //   - `TrailNode.tsx:firstHandlesKeyRef` skips the call on
          //     initial mount (each remount during pan is a "fresh"
          //     instance, so the ref initializes to the current
          //     handlesKey and the effect short-circuits — confirmed
          //     in Trace-20260519T025639.json.gz, ~50 cascade events
          //     vs the 1808 the old behaviour produced).
          //   - `url-blocklist.ts:predicateCache` caches per-URL
          //     match results so `computeChainFoldInfo` walks no
          //     longer thrash GC on each TREE_UPDATED (commit 3ff723f0).
          //
          // With cull ON, only ~50–100 visible TrailNodes run their
          // memo comparator + useStore(selectLod) per render instead
          // of all 1808. Per-frame work drops ~20×; React commit cost
          // scales with viewport size, not tree size.
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
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={defaultEdgeOptions}
        >
          <GraphBackground />
          <LodController targetRef={containerRef} />
          <GraphControls
            onCenterCurrent={handleCenterCurrent}
            canCenterCurrent={canCenterCurrent}
          />
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
