import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "../../../../ui/lib/utils.js";
import type { NodeId } from "@shared/types/ids.js";
import type { NavigationNode } from "@shared/types/node.js";
import { navigateTo, reparentNode } from "@apps/sidepanel/api/tree.js";
import { rpc } from "@shared/rpc/contracts.js";
import { fireAndForget } from "@apps/sidepanel/api/background.js";
// Layout config constants used by useGraphView hook.
import {
  calculateLayout,
  calculateMindmapLayout,
  calculateRadialLayout,
  getCanvasBounds,
  computeSubtreeSpans,
} from "../../graph/layout/calculator.js";
import { deriveLayoutOptions } from "../../graph/layout/options.js";
import {
  computeSubtreeScores,
  computeNodeScore,
  incrementalCenterReorder,
  incrementalClusterReorder,
} from "@shared/lib/recency.js";
import type { CanvasBounds, LayoutMode, NodePosition } from "../../graph/types.js";
// animation-utils.js used by useGraphAnimation and useGraphView hooks.
import GraphZoomControls from "./GraphZoomControls.js";
import { applyPathHighlight, buildConnections, getPathToNode } from "./graph-utils.js";
import { GraphPixiRenderer } from "../../graph/render/GraphPixiRenderer.js";
import { graphProfiler, profileSync, STARTUP_T0 } from "../../graph/render/graph-profiler.js";
import type {
  ConnectionSegment,
  NodeRenderModel,
  ParticleRenderModel,
} from "../../graph/render/types.js";
import { createGraphSnapshot, type GraphSnapshot } from "../../graph/render/graph-snapshot.js";
import type { TabState } from "@shared/types/tabs.js";
import { easeOutCubic, lerp } from "../../graph/animation-utils.js";
import { toast } from "sonner";
import { invalidateLayoutCache } from "@shared/graph-layout-cache/cache.js";
// grid-transform.js used by useGraphView hook.
import { browser, runtimeGetURL } from "@shared/platform/webext.js";
// selection-utils.js is now used via useGraphSelection hook.
import type {
  GraphCanvasProps,
  DragNodeState,
  DragReparentPreview,
  LayoutUpdateMap,
  PointerHitTarget,
  PointerInfo,
} from "./graph-canvas-types.js";
import { collectSubtreeIds, buildCollapseScope } from "./graph-canvas-utils.js";
import { computeOffsetPositions, computeDragOffsetPositions } from "./graph-layout-compute.js";
import {
  computeCollapseSignature,
  computeLayoutSignature,
  type CachedLayoutResult,
} from "@shared/graph-layout-cache/types.js";
import { DEFAULT_LAYOUT_SETTINGS } from "@shared/layout/defaults.js";
import { useLayoutSend } from "./useLayoutSend.js";
import { useGraphSelection } from "./useGraphSelection.js";
import { useGraphAnimation, FAST_MOTION } from "./useGraphAnimation.js";
import { useGraphView } from "./useGraphView.js";

// ---------------------------------------------------------------------------
// Offscreen layout cache — read from global set by main.tsx before mount
// ---------------------------------------------------------------------------

function consumePrefetchedLayout(): CachedLayoutResult | null {
  const cached = globalThis.__trailCachedLayout ?? null;
  if (cached) globalThis.__trailCachedLayout = null; // Consume once
  return cached;
}

let _prefetchedLayout: CachedLayoutResult | null = consumePrefetchedLayout();
let _bootstrapRecorded = false;

function hydrateFromCache(
  cached: CachedLayoutResult,
  root: NavigationNode,
): { positions: Map<NodeId, NodePosition>; width: number } | null {
  const nodeMap = new Map<NodeId, NavigationNode>();
  const queue: NavigationNode[] = [root];
  while (queue.length > 0) {
    const node = queue.pop()!;
    nodeMap.set(node.id, node);
    for (const child of node.getChildren()) queue.push(child);
  }

  const positions = new Map<NodeId, NodePosition>();
  for (const [id, pos] of Object.entries(cached.positions)) {
    const nodeId = Number(id) as NodeId;
    const node = nodeMap.get(nodeId);
    if (node) positions.set(nodeId, { x: pos.x, y: pos.y, node });
  }

  // Only use cache if most nodes matched (handles minor tree changes)
  if (positions.size < nodeMap.size * 0.8) return null;
  return { positions, width: cached.width };
}

/** Distance (in world pixels) from the dragged node center to a candidate
 *  parent center at which the snap preview activates. */
const SNAP_RADIUS = 250;

// Animation constants moved to useGraphAnimation.ts

export default function GraphCanvas({
  tree,
  treeUpdate,
  currentNodeId,
  openNodeIds,
  collapsedNodeIds,
  collapseVersion,
  collapseAction,
  nodeTabCounts,
  nodeRecency,
  tabStates,
  search,
  settings,
  showConnections,
  detailMode,
  connectionQuality,
  graphView,
  tool,
  selectedNodeIds,
  hoverNodeId,
  resetVersion,
  viewIntent,
  onGraphToolChange,
  onSelectedNodeIdsChange,
  onClearSelection,
  onGraphViewChange,
  onSetHoverNodeId,
  onOpenContextMenu,
  onClearViewIntent,
  onExpandNodes,
  onRenderMetrics,
  editorActive,
  pickTarget,
  onPickTargetComplete,
  fullViewEnabled,
  recencyOrderingV2Enabled,
  showControls,
  compactInitialView = false,
  initialCenterNodeId,
  onNodeActivate,
  onGestureActiveChange,
}: GraphCanvasProps) {
  const searchActive = search.active;
  const searchNavStep = search.navStep;
  const effectiveShowConnections = showConnections;

  const pixiHostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<GraphPixiRenderer | null>(null);
  const emptyPositionsRef = useRef<Map<NodeId, NodePosition>>(new Map());

  const positionsRef = useRef<Map<NodeId, NodePosition>>(new Map());
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [dragPreview, setDragPreview] = useState<LayoutUpdateMap | null>(null);
  const { layoutSendRef, flushLayoutUpdates, queueLayoutUpdates } = useLayoutSend();
  const isPanningRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const pointerDownNodeIdRef = useRef<NodeId | null>(null);
  const pointerDownTargetRef = useRef<PointerHitTarget | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    mode: LayoutMode;
    nodes: DragNodeState[];
    latestLayouts: LayoutUpdateMap;
  } | null>(null);
  const dragMovedRef = useRef(false);
  const nodeDragJustEndedRef = useRef(false);
  const dragReparentRef = useRef<DragReparentPreview | null>(null);
  const dragAffectedIdsRef = useRef<Set<NodeId> | null>(null);
  const prevDragPositionsRef = useRef<Map<NodeId, NodePosition> | null>(null);
  const [dragReparentTarget, setDragReparentTarget] = useState<{
    draggedId: NodeId;
    originalParentId: NodeId;
    targetId: NodeId | null;
  } | null>(null);
  const {
    selectionBoxRef,
    isSelectingRef,
    selectionStartRef,
    baseSelectionRef,
    selectionModeRef,
    selectionDragRef,
    selectionWorldRectRef,
    previewSelectionRef,
    updateSelectionBox,
    hideSelectionBox: _hideSelectionBox,
    scheduleSelectionPreview,
    finalizeSelection,
    clearSelectionState,
  } = useGraphSelection({
    rendererRef,
    positionsRef,
    onSelectedNodeIdsChange,
    onClearSelection,
  });
  const panStartRef = useRef({ x: 0, y: 0 });
  const panPointerStartRef = useRef({ x: 0, y: 0 });
  const panMovedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const lastHoverNodeIdRef = useRef<NodeId | null>(null);
  const hoverDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cachedBaseConnectionsRef = useRef<ConnectionSegment[]>([]);
  const snapshotRef = useRef<GraphSnapshot | null>(null);
  const prevSnapshotVersionRef = useRef<number>(0);

  // Snapshot of render state for imperative animation path (populated after useMemos, read from RAF)
  const latestRenderStateRef = useRef<{
    visibleDisplayNodes: NodePosition[];
    positions: Map<NodeId, NodePosition>;
    display: {
      titleTruncation: "start" | "middle" | "end";
      showFavicons: boolean;
      showUrls: boolean;
      showTagDots: boolean;
      showTabCounts: boolean;
      showAudioIndicators: boolean;
      dimClosedNodes: boolean;
    };
    currentNodeId: NodeId | null;
    openNodeIds: Set<NodeId>;
    collapsedNodeIds: Set<NodeId>;
    searchActive: boolean;
    searchSet: Set<NodeId>;
    focusedSearchId: NodeId | undefined;
    hoverNodeId: NodeId | null;
    tabStates: Record<NodeId, TabState | undefined>;
    nodeTabCounts: Record<NodeId, number>;
    nodeWidth: number;
    nodeHeight: number;
    effectiveShowConnections: boolean;
    root: NavigationNode | null;
    layoutMode: LayoutMode;
    hideTreeRoot: boolean;
    pathNodeIds: Set<NodeId> | null;
    snapshot: GraphSnapshot;
  } | null>(null);

  // View/camera logic extracted to useGraphView hook (initialized after bounds computation).

  const layoutOptions = useMemo(() => deriveLayoutOptions(settings), [settings]);
  const baseLayoutConfig =
    layoutOptions.mode === "mindmap" ? layoutOptions.mindmap : layoutOptions.tree;
  const hideTreeRoot = settings?.layout?.tree?.hideRoot ?? false;
  const root = tree?.getRoot() ?? null;
  const { nodeWidth, nodeHeight } = baseLayoutConfig;

  // Imperative tick render — ref holds the actual implementation (assigned after hook call).
  // The stable wrapper delegates to handleTickRenderRef.current so the hook always
  // reads the latest closure which has access to animatedPositionsRef etc.
  const handleTickRenderRef = useRef<(() => void) | null>(null);
  const handleTickRender = useCallback(() => {
    handleTickRenderRef.current?.();
  }, []);

  const animation = useGraphAnimation({ nodeWidth, nodeHeight, onTickRender: handleTickRender });
  const {
    animationVersion,
    particleVersion,
    particleAnimationsRef,
    animationStatesRef,
    openAnimationStatesRef,
    openProgressRef,
    animatedPositionsRef,
    exitNodesRef,
    prevPositionsRef,
    animationNowRef,
    prevOpenNodesRef,
    previousSiblingOrderRef,
    mindmapSideRef,
    lastCollapseVersionRef,
    invalidateAnimation,
    startAnimationLoop,
    startEnter,
    startExit,
    startMove,
    particleRenderModels,
    animationDuration,
    animationStagger,
    openAnimationDuration,
  } = animation;

  // Assign the actual imperative render function now that hook refs are available.
  // This runs on every render, keeping the closure fresh with latest refs.
  handleTickRenderRef.current = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const s = latestRenderStateRef.current;
    if (!s) return;

    // Build renderNodes imperatively (same logic as renderNodes useMemo)
    const dimmedBySearch = s.searchActive;
    const nodes: NodeRenderModel[] = s.visibleDisplayNodes.map((pos) => {
      const id = pos.node.id;
      const override = animatedPositionsRef.current.get(id);
      const x = override?.x ?? pos.x;
      const y = override?.y ?? pos.y;
      const isOpen = s.openNodeIds.has(id);
      return {
        id,
        node: pos.node,
        x,
        y,
        width: s.nodeWidth,
        height: s.nodeHeight,
        isCurrent: s.currentNodeId === id,
        isOpen,
        openProgress: s.display.dimClosedNodes
          ? (openProgressRef.current.get(id) ?? (isOpen ? 1 : 0))
          : 1,
        tabCount: s.nodeTabCounts[id] ?? 0,
        ...(s.tabStates[id] !== undefined ? { tabState: s.tabStates[id] } : {}),
        isCollapsed: s.collapsedNodeIds.has(id),
        isSelected: false,
        isPreview: false,
        isSearchMatch: s.searchSet.has(id),
        isSearchFocused: s.focusedSearchId === id,
        isSearchDimmed: dimmedBySearch && !s.searchSet.has(id),
        isHoverFocused: false,
        display: s.display,
      };
    });

    // Apply path highlight on cached base connections (no rebuild needed)
    const conns = s.effectiveShowConnections
      ? applyPathHighlight(cachedBaseConnectionsRef.current, s.pathNodeIds)
      : [];

    renderer.setDynamicState({
      nodes,
      connections: conns,
      showConnections: s.effectiveShowConnections,
    });

    // Build particle render models imperatively
    const particles: ParticleRenderModel[] = particleAnimationsRef.current.map((p) => {
      const progress = Math.min(1, p.age / p.life);
      const eased = easeOutCubic(progress);
      return {
        id: p.id,
        x: lerp(p.startX, p.endX, eased),
        y: lerp(p.startY, p.endY, eased),
        radius: p.radius,
        alpha: Math.max(0, 1 - progress),
      };
    });
    renderer.setParticles(particles);
  };

  const effectiveNodeScores = useMemo(() => {
    if (!recencyOrderingV2Enabled || !root) return null;
    const now = Date.now();
    const next = {} as Record<NodeId, number>;
    root.forEach((node) => {
      const lastVisited =
        typeof node.data.lastVisitedAt === "number" && Number.isFinite(node.data.lastVisitedAt)
          ? Number(node.data.lastVisitedAt)
          : Number(node.timestamp);
      const liveRecency = nodeRecency[node.id] ?? 0;
      const bestRecency = Math.max(lastVisited, liveRecency);
      const visitCount = typeof node.data.visitCount === "number" ? node.data.visitCount : 0;
      next[node.id] = computeNodeScore(visitCount, bestRecency, now);
    });
    return next;
  }, [nodeRecency, root, recencyOrderingV2Enabled]);

  const subtreeScores = useMemo(() => {
    if (!root || !recencyOrderingV2Enabled || !effectiveNodeScores) return null;
    return computeSubtreeScores(
      root,
      effectiveNodeScores,
      (n: NavigationNode) => n.getChildren?.() ?? [],
    );
  }, [effectiveNodeScores, root, recencyOrderingV2Enabled]);

  useEffect(() => {
    previousSiblingOrderRef.current.clear();
    mindmapSideRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mindmapSideRef and previousSiblingOrderRef are refs, intentionally omitted
  }, [recencyOrderingV2Enabled, root?.id]);

  // Collapse-filtered children WITHOUT recency sorting (for span pre-pass)
  const getBaseVisibleChildren = useCallback(
    (node: NavigationNode) => {
      if (collapsedNodeIds.has(node.id)) return [];
      return node.getChildren?.() ?? [];
    },
    [collapsedNodeIds],
  );

  // Pre-compute exact tidy-tree spans for balanced recency placement
  const subtreeSpans = useMemo(() => {
    if (!root || !subtreeScores || !recencyOrderingV2Enabled) return null;
    const baseSep = Math.max(baseLayoutConfig.nodeWidth + baseLayoutConfig.horizontalGap, 1);
    return computeSubtreeSpans(root, getBaseVisibleChildren, baseSep);
  }, [
    root,
    subtreeScores,
    getBaseVisibleChildren,
    baseLayoutConfig.nodeWidth,
    baseLayoutConfig.horizontalGap,
    recencyOrderingV2Enabled,
  ]);

  const reorderFn =
    layoutOptions.mode === "radial" ? incrementalClusterReorder : incrementalCenterReorder;

  const sortChildrenForParentKey = useCallback(
    (parentKey: string, children: readonly NavigationNode[]): NavigationNode[] => {
      if (!recencyOrderingV2Enabled || !subtreeScores || children.length <= 1) return [...children];
      const previousSiblingOrder = previousSiblingOrderRef.current.get(parentKey);
      const sorted = reorderFn(children, subtreeScores, previousSiblingOrder, subtreeSpans);
      previousSiblingOrderRef.current.set(
        parentKey,
        sorted.map((child: NavigationNode) => child.id),
      );
      return sorted;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previousSiblingOrderRef is a ref, intentionally omitted
    [recencyOrderingV2Enabled, subtreeScores, subtreeSpans, reorderFn],
  );

  const getVisibleChildren = useCallback(
    (node: NavigationNode) => {
      if (collapsedNodeIds.has(node.id)) return [];
      const children = node.getChildren?.() ?? [];
      return sortChildrenForParentKey(String(node.id), children);
    },
    [collapsedNodeIds, sortChildrenForParentKey],
  );

  // View sync, renderer init, selectedNodeIds sync, resize observer
  // are handled by useGraphView hook + inline renderer effects below.

  useEffect(() => {
    const observer = new MutationObserver(() => rendererRef.current?.refreshTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    let cancelled = false;
    void fonts.ready.then(() => {
      if (cancelled) return;
      rendererRef.current?.refreshTheme();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // flushLayoutUpdates and queueLayoutUpdates provided by useLayoutSend hook.

  // cancelViewAnimation and animateViewTo provided by useGraphView hook.

  const layout = useMemo(() => {
    if (!root) return null;

    const layoutStart = performance.now();

    // Record bootstrap timing once when tree first becomes available
    if (!_bootstrapRecorded) {
      _bootstrapRecorded = true;
      graphProfiler.recordStartup("bootstrapMs", performance.now() - STARTUP_T0);
    }

    // Build current layout signature for cache comparison
    const currentCollapseSignature = computeCollapseSignature(collapsedNodeIds);
    const settingsLayout = settings?.layout ?? DEFAULT_LAYOUT_SETTINGS;
    const density = settings?.graphDensity ?? "comfortable";
    const currentSignature = computeLayoutSignature({
      mode: layoutOptions.mode,
      density,
      tree: {
        verticalGapScale: settingsLayout.tree.verticalGapScale,
        horizontalGapScale: settingsLayout.tree.horizontalGapScale,
      },
      mindmap: {
        verticalGapScale: settingsLayout.mindmap.verticalGapScale,
        horizontalGapScale: settingsLayout.mindmap.horizontalGapScale,
      },
      radial: settingsLayout.radial,
      collapseSignature: currentCollapseSignature,
      recencyOrdering: recencyOrderingV2Enabled,
    });

    // Fast path: use pre-computed layout from offscreen document
    if (_prefetchedLayout) {
      const cachedSig = _prefetchedLayout.layoutSignature;
      if (cachedSig && cachedSig === currentSignature) {
        let hydrated: { positions: Map<NodeId, NodePosition>; width: number } | null = null;
        try {
          hydrated = hydrateFromCache(_prefetchedLayout, root);
        } catch (cacheError) {
          console.error("[GraphCanvas] Cache hydration failed, clearing corrupt entry:", cacheError);
          toast.warning("Layout cache was corrupted and has been reset");
          void invalidateLayoutCache(_prefetchedLayout.treeId);
          _prefetchedLayout = null;
        }
        if (hydrated) {
          _prefetchedLayout = null;
          graphProfiler.recordStartup("cacheHitType", "exact");
          graphProfiler.recordStartup("layoutMs", performance.now() - layoutStart);
          graphProfiler.recordStartup("nodeCount", hydrated.positions.size);
          graphProfiler.recordStartup("layoutMode", layoutOptions.mode);
          return hydrated;
        }
      }
      // Signature missing (old cache format) — fall back to field-by-field check
      if (!cachedSig && _prefetchedLayout?.layoutMode === layoutOptions.mode) {
        const cacheCollapseMatch =
          (_prefetchedLayout.collapseSignature ?? "") === currentCollapseSignature;
        const cacheRecencyMatch =
          (_prefetchedLayout.recencyOrdering ?? false) === recencyOrderingV2Enabled;
        if (cacheCollapseMatch && cacheRecencyMatch) {
          let hydrated: { positions: Map<NodeId, NodePosition>; width: number } | null = null;
          try {
            hydrated = hydrateFromCache(_prefetchedLayout, root);
          } catch (cacheError) {
            console.error("[GraphCanvas] Cache hydration failed, clearing corrupt entry:", cacheError);
            toast.warning("Layout cache was corrupted and has been reset");
            void invalidateLayoutCache(_prefetchedLayout.treeId);
            _prefetchedLayout = null;
          }
          if (hydrated) {
            _prefetchedLayout = null;
            graphProfiler.recordStartup("cacheHitType", "fallback");
            graphProfiler.recordStartup("layoutMs", performance.now() - layoutStart);
            graphProfiler.recordStartup("nodeCount", hydrated.positions.size);
            graphProfiler.recordStartup("layoutMode", layoutOptions.mode);
            return hydrated;
          }
        }
      }
      // Cache miss — stale or incompatible
      graphProfiler.recordStartup("cacheHitType", _prefetchedLayout ? "stale" : "miss");
      _prefetchedLayout = null;
    }

    // No cache hit — compute layout from scratch
    const result = profileSync("layout", () => {
      switch (layoutOptions.mode) {
        case "tree":
          return calculateLayout(root, layoutOptions.tree, getVisibleChildren);
        case "mindmap": {
          const sortWithinSide = subtreeScores
            ? (children: readonly NavigationNode[], side: "left" | "right") =>
                sortChildrenForParentKey(`${String(root.id)}:${side}`, children)
            : undefined;
          // Stable side assignment: remember which side each child was on
          const splitSides = recencyOrderingV2Enabled
            ? (children: readonly NavigationNode[], subtreeHeights: Map<NodeId, number>) => {
                const sideMap = mindmapSideRef.current;
                const left: NavigationNode[] = [];
                const right: NavigationNode[] = [];
                const unassigned: NavigationNode[] = [];

                for (const child of children) {
                  const stored = sideMap.get(child.id);
                  if (stored === "left") left.push(child);
                  else if (stored === "right") right.push(child);
                  else unassigned.push(child);
                }

                // Assign new children to the lighter side
                let leftH = left.reduce((s, c) => s + (subtreeHeights.get(c.id) ?? 0), 0);
                let rightH = right.reduce((s, c) => s + (subtreeHeights.get(c.id) ?? 0), 0);
                for (const child of unassigned) {
                  const h = subtreeHeights.get(child.id) ?? 0;
                  if (leftH <= rightH) {
                    left.push(child);
                    sideMap.set(child.id, "left");
                    leftH += h;
                  } else {
                    right.push(child);
                    sideMap.set(child.id, "right");
                    rightH += h;
                  }
                }

                // Persist sides for existing children
                for (const c of left) sideMap.set(c.id, "left");
                for (const c of right) sideMap.set(c.id, "right");

                return { left, right };
              }
            : undefined;
          return calculateMindmapLayout(root, layoutOptions.mindmap, getVisibleChildren, {
            ...(sortWithinSide ? { sortWithinSide } : {}),
            ...(splitSides ? { splitSides } : {}),
          });
        }
        default:
          return calculateRadialLayout(
            root,
            layoutOptions.radial,
            baseLayoutConfig,
            getVisibleChildren,
          );
      }
    });

    graphProfiler.recordStartup("layoutMs", performance.now() - layoutStart);
    graphProfiler.recordStartup("nodeCount", result?.positions.size ?? 0);
    graphProfiler.recordStartup("layoutMode", layoutOptions.mode);
    if (graphProfiler.getStartupMetrics().cacheHitType === null) {
      graphProfiler.recordStartup("cacheHitType", "miss");
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mindmapSideRef is a ref; collapsedNodeIds and recencyOrderingV2Enabled are captured via getVisibleChildren/sortChildrenForParentKey
  }, [
    baseLayoutConfig,
    getVisibleChildren,
    layoutOptions.mode,
    layoutOptions.mindmap,
    layoutOptions.radial,
    layoutOptions.tree,
    root,
    settings,
    sortChildrenForParentKey,
    subtreeScores,
  ]);

  // Record first-render timing once after the first layout resolves
  const firstRenderRecordedRef = useRef(false);
  useEffect(() => {
    if (layout && !firstRenderRecordedRef.current) {
      firstRenderRecordedRef.current = true;
      requestAnimationFrame(() => {
        graphProfiler.recordStartup("firstRenderMs", performance.now() - STARTUP_T0);
      });
    }
  }, [layout]);

  const basePositions = layout?.positions ?? emptyPositionsRef.current;
  const positions = useMemo(
    () =>
      profileSync("computeOffsetPositions", () => {
        const affected = dragAffectedIdsRef.current;
        const prev = prevDragPositionsRef.current;
        // Use partial computation during drag when previous positions are available
        if (dragPreview && affected && prev) {
          return computeDragOffsetPositions(
            basePositions,
            prev,
            layoutOptions.mode,
            nodeWidth,
            nodeHeight,
            root,
            dragPreview,
            affected,
          );
        }
        return computeOffsetPositions(
          basePositions,
          layoutOptions.mode,
          nodeWidth,
          nodeHeight,
          root,
          dragPreview,
        );
      }),
    [basePositions, dragPreview, layoutOptions.mode, nodeHeight, nodeWidth, root],
  );
  // Store computed positions for incremental drag updates on next frame
  if (dragPreview) {
    prevDragPositionsRef.current = positions;
  }
  positionsRef.current = positions;

  // Track whether the most recent change was a topology/layout change.
  // staticVersion increments only when basePositions, layoutMode, nodeWidth, or nodeHeight change.
  const staticVersionRef = useRef(0);
  const prevStaticDepsRef = useRef<{
    layoutMode: LayoutMode;
    nodeWidth: number;
    nodeHeight: number;
    basePositions: Map<NodeId, NodePosition>;
  } | null>(null);

  const staticVersion = useMemo(() => {
    const prev = prevStaticDepsRef.current;
    if (prev === null) {
      prevStaticDepsRef.current = {
        layoutMode: layoutOptions.mode,
        nodeWidth,
        nodeHeight,
        basePositions,
      };
      staticVersionRef.current += 1;
      return staticVersionRef.current;
    }
    const changed =
      prev.layoutMode !== layoutOptions.mode ||
      prev.nodeWidth !== nodeWidth ||
      prev.nodeHeight !== nodeHeight ||
      prev.basePositions !== basePositions;
    prevStaticDepsRef.current = {
      layoutMode: layoutOptions.mode,
      nodeWidth,
      nodeHeight,
      basePositions,
    };
    if (changed) {
      staticVersionRef.current += 1;
    }
    return staticVersionRef.current;
  }, [layoutOptions.mode, nodeWidth, nodeHeight, basePositions]);

  // Animation helpers (spawnExitParticles, queueNodeAnimation, startEnter, startExit, startMove)
  // are provided by useGraphAnimation hook above.

  useLayoutEffect(() => {
    const prev = prevPositionsRef.current;
    const current = new Map(positions);
    if (prev.size === 0) {
      prevPositionsRef.current = current;
      return;
    }
    const pendingCollapseAction =
      collapseVersion !== lastCollapseVersionRef.current ? collapseAction : null;
    const collapseScope = pendingCollapseAction
      ? buildCollapseScope(tree ?? null, pendingCollapseAction.nodeIds)
      : null;
    const collapseCenters = new Map<NodeId, { x: number; y: number }>();
    const getCollapseCenter = (rootId: NodeId, fallback: { x: number; y: number }) => {
      const cached = collapseCenters.get(rootId);
      if (cached) return cached;
      const rootPos = current.get(rootId);
      const center = rootPos
        ? { x: rootPos.x + nodeWidth / 2, y: rootPos.y + nodeHeight / 2 }
        : fallback;
      collapseCenters.set(rootId, center);
      return center;
    };
    const suppressMoveAnimations = isDraggingNode || (dragPreview?.size ?? 0) > 0;
    const enteringIds = new Set<NodeId>();
    const exitingIds = new Set<NodeId>();
    current.forEach((_pos, id) => {
      if (!prev.has(id)) enteringIds.add(id);
    });
    prev.forEach((_pos, id) => {
      if (!current.has(id)) exitingIds.add(id);
    });

    const enterDepthCache = new Map<NodeId, number>();
    const getEnterDepth = (node: NavigationNode): number => {
      if (!enteringIds.has(node.id)) return 0;
      const cached = enterDepthCache.get(node.id);
      if (cached !== undefined) return cached;
      const parent = node.getParent?.();
      const depth = parent && enteringIds.has(parent.id) ? getEnterDepth(parent) + 1 : 0;
      enterDepthCache.set(node.id, depth);
      return depth;
    };

    const exitDepthCache = new Map<NodeId, number>();
    const getExitDepth = (node: NavigationNode): number => {
      if (!exitingIds.has(node.id)) return -1;
      const cached = exitDepthCache.get(node.id);
      if (cached !== undefined) return cached;
      let maxChildDepth = -1;
      node.getChildren().forEach((child) => {
        if (!exitingIds.has(child.id)) return;
        maxChildDepth = Math.max(maxChildDepth, getExitDepth(child));
      });
      const depth = maxChildDepth + 1;
      exitDepthCache.set(node.id, depth);
      return depth;
    };

    const currentRootPos = root ? current.get(root.id) : undefined;
    const currentRootCenter = {
      x: currentRootPos ? currentRootPos.x + nodeWidth / 2 : 0,
      y: currentRootPos ? currentRootPos.y + nodeHeight / 2 : 0,
    };
    current.forEach((pos, id) => {
      if (enteringIds.has(id)) {
        const isExpandNode = pendingCollapseAction?.kind === "expand" && collapseScope?.has(id);
        const parent = pos.node.getParent?.();
        const parentPos = parent ? current.get(parent.id) : undefined;
        const startCenter = parentPos
          ? { x: parentPos.x + nodeWidth / 2, y: parentPos.y + nodeHeight / 2 }
          : currentRootCenter;
        const depth = getEnterDepth(pos.node);
        const stagger = isExpandNode ? FAST_MOTION.stagger : animationStagger;
        const durationMs = isExpandNode ? FAST_MOTION.duration : animationDuration;
        startEnter(pos, startCenter, depth * stagger, durationMs);
        return;
      }
      const prevPos = prev.get(id);
      if (!prevPos) return;
      const dx = pos.x - prevPos.x;
      const dy = pos.y - prevPos.y;
      if (dx * dx + dy * dy > 1 && !suppressMoveAnimations) {
        startMove(id, prevPos.x, prevPos.y, pos.x, pos.y);
      }
    });

    const isDelete = treeUpdate?.reason === "delete";
    const popDuration = Math.max(120, Math.round(animationDuration * 0.4));
    prev.forEach((pos, id) => {
      if (!exitingIds.has(id)) return;
      const collapseRootId =
        pendingCollapseAction?.kind === "collapse" ? collapseScope?.get(id) : undefined;
      if (collapseRootId) {
        const endCenter = getCollapseCenter(collapseRootId, {
          x: pos.x + nodeWidth / 2,
          y: pos.y + nodeHeight / 2,
        });
        const delayMs = getExitDepth(pos.node) * FAST_MOTION.stagger;
        startExit(pos, endCenter, delayMs, FAST_MOTION.duration, { spawnParticles: false });
        return;
      }
      if (isDelete) {
        const parent = pos.node.getParent?.();
        if (parent && exitingIds.has(parent.id)) {
          return;
        }
      }
      const endCenter = { x: pos.x + nodeWidth / 2, y: pos.y + nodeHeight / 2 };
      const delayMs = isDelete ? 0 : getExitDepth(pos.node) * animationStagger;
      startExit(pos, endCenter, delayMs, isDelete ? popDuration : animationDuration);
    });
    prevPositionsRef.current = current;
    if (pendingCollapseAction) {
      lastCollapseVersionRef.current = collapseVersion;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lastCollapseVersionRef and prevPositionsRef are refs, intentionally omitted
  }, [
    animationDuration,
    animationStagger,
    collapseAction,
    collapseVersion,
    dragPreview,
    isDraggingNode,
    nodeHeight,
    nodeWidth,
    positions,
    root,
    tree,
    startEnter,
    startExit,
    startMove,
    treeUpdate?.reason,
  ]);

  const bounds: CanvasBounds = useMemo(() => {
    if (!layout) {
      return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
    }
    return getCanvasBounds(positions, nodeWidth, nodeHeight);
  }, [layout, nodeHeight, nodeWidth, positions]);

  // --- View / Camera hook (must come after bounds + positions) ---
  const [gestureActive, setGestureActive] = useState(false);
  const onGestureActiveChangeRef = useRef(onGestureActiveChange);
  useEffect(() => {
    onGestureActiveChangeRef.current = onGestureActiveChange;
  }, [onGestureActiveChange]);
  useEffect(() => {
    onGestureActiveChangeRef.current?.(gestureActive);
  }, [gestureActive]);

  const {
    wrapperRef,
    viewRef,
    applyGridTransform,
    scheduleGraphView,
    commitViewOnGestureEnd,
    cancelViewAnimation,
    animateViewTo: _animateViewTo,
    fitToView: _fitToView,
    centerOnNode: _centerOnNode,
    zoomAt,
    zoom,
  } = useGraphView({
    graphView,
    onGraphViewChange,
    rendererRef,
    bounds,
    positions,
    nodeWidth,
    nodeHeight,
    compactInitialView,
    initialCenterNodeId: initialCenterNodeId ?? null,
    nodeRecency,
    currentNodeId,
    root,
    viewIntent: viewIntent ?? null,
    onClearViewIntent,
    isDraggingNode,
    searchActive,
    searchNavStep,
    focusedSearchId: search.results[search.index],
    resetVersion,
    layoutMode: layoutOptions.mode,
    isPanningRef,
    isSelectingRef,
    onGestureActiveChange: setGestureActive,
  });

  // --- Renderer init (depends on applyGridTransform from view hook) ---
  useEffect(() => {
    const host = pixiHostRef.current;
    if (!host) return;
    const renderer = new GraphPixiRenderer(host);
    rendererRef.current = renderer;
    renderer.setView(viewRef.current);
    renderer.setDetailMode(detailMode);
    renderer.setConnectionQuality(connectionQuality);
    renderer.setMetricsListener(onRenderMetrics);
    applyGridTransform(viewRef.current);
    return () => {
      renderer.setMetricsListener(null);
      renderer.destroy();
      rendererRef.current = null;
      // Clean up hover debounce timer
      if (hoverDebounceRef.current !== null) {
        clearTimeout(hoverDebounceRef.current);
        hoverDebounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: viewRef is a ref; detailMode/connectionQuality/onRenderMetrics are applied via separate imperative effects to avoid destroying/recreating the GPU renderer
  }, [applyGridTransform]);

  useEffect(() => {
    rendererRef.current?.setSelectedNodeIds(selectedNodeIds);
  }, [selectedNodeIds]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const resizeObserver = new ResizeObserver(() => {
      rendererRef.current?.resizeToHost();
      rendererRef.current?.setView(viewRef.current);
      applyGridTransform(viewRef.current);
    });
    resizeObserver.observe(wrapper);
    return () => resizeObserver.disconnect();
  }, [applyGridTransform, viewRef, wrapperRef]);

  const displayNodes = useMemo(() => {
    const list = Array.from(positions.values());
    exitNodesRef.current.forEach((pos) => list.push(pos));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- exitNodesRef is a ref; animationVersion is the reactive trigger that causes this to re-run
  }, [positions, animationVersion]);
  const pendingEnterIds = useMemo(() => {
    if (animationStatesRef.current.size === 0) return new Set<NodeId>();
    const now = animationNowRef.current ?? performance.now();
    const pending = new Set<NodeId>();
    animationStatesRef.current.forEach((state, id) => {
      if (state.type === "enter" && state.startTime > now) {
        pending.add(id);
      }
    });
    return pending;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animationStatesRef and animationNowRef are refs; animationVersion is the reactive trigger
  }, [animationVersion]);
  const visibleDisplayNodes = useMemo(() => {
    return displayNodes.filter((pos) => !pendingEnterIds.has(pos.node.id));
  }, [displayNodes, pendingEnterIds]);
  const searchSet = useMemo(() => new Set(search.results), [search.results]);
  const focusedSearchId = search.results[search.index];
  const display = useMemo(
    () => ({
      titleTruncation: settings?.titleTruncation ?? "end",
      showFavicons: settings?.showFavicons ?? true,
      showUrls: settings?.showUrls ?? true,
      showTagDots: settings?.showTagDots ?? true,
      showTabCounts: settings?.showTabCounts ?? true,
      showAudioIndicators: settings?.showAudioIndicators ?? true,
      dimClosedNodes: settings?.dimClosedNodes ?? true,
    }),
    [settings],
  );

  useLayoutEffect(() => {
    const activeIds = new Set<NodeId>();
    positions.forEach((_pos, id) => {
      activeIds.add(id);
    });
    exitNodesRef.current.forEach((_pos, id) => {
      activeIds.add(id);
    });

    const openStates = openAnimationStatesRef.current;
    const openProgress = openProgressRef.current;

    if (activeIds.size === 0) {
      openProgress.clear();
      openStates.clear();
      prevOpenNodesRef.current = new Set<NodeId>();
      return;
    }

    if (!display.dimClosedNodes) {
      activeIds.forEach((id) => {
        openProgress.set(id, 1);
      });
      openProgress.forEach((_value, id) => {
        if (!activeIds.has(id)) {
          openProgress.delete(id);
        }
      });
      openStates.clear();
      prevOpenNodesRef.current = new Set(openNodeIds);
      invalidateAnimation();
      return;
    }

    const prevOpen = prevOpenNodesRef.current;
    const isInitial = prevOpen.size === 0 && openProgress.size === 0;
    const now = performance.now();

    activeIds.forEach((id) => {
      const target = openNodeIds.has(id) ? 1 : 0;
      if (isInitial) {
        openProgress.set(id, target);
        return;
      }
      const current = openProgress.get(id) ?? (prevOpen.has(id) ? 1 : target);
      if (current === target) return;
      openStates.set(id, {
        id,
        from: current,
        to: target,
        startTime: now,
        duration: openAnimationDuration,
      });
    });

    openProgress.forEach((_value, id) => {
      if (!activeIds.has(id)) {
        openProgress.delete(id);
        openStates.delete(id);
      }
    });

    prevOpenNodesRef.current = new Set(openNodeIds);
    if (openStates.size > 0) {
      invalidateAnimation();
      startAnimationLoop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- exitNodesRef, openAnimationDuration, openAnimationStatesRef, openProgressRef, prevOpenNodesRef are all refs, intentionally omitted
  }, [display.dimClosedNodes, invalidateAnimation, openNodeIds, positions, startAnimationLoop]);

  const handleNodeClick = useCallback(
    async (node: NavigationNode) => {
      if (dragMovedRef.current) {
        dragMovedRef.current = false;
        return;
      }

      // Pick-target mode: clicking a node completes the operation
      if (pickTarget) {
        if (pickTarget.type === "duplicate") {
          fireAndForget(
            rpc.duplicateSubtree({
              nodeId: pickTarget.sourceNodeId,
              targetParentId: node.id,
            }),
          );
        }
        onPickTargetComplete();
        return;
      }

      if (tool === "hand") {
        try {
          if (onNodeActivate) {
            onNodeActivate(node.id, node.data.url);
          } else {
            await navigateTo(node);
          }
        } catch (error) {
          console.error("Failed to navigate:", error);
        }
        return;
      }

      if (tool !== "select") return;

      if (editorActive) {
        onSelectedNodeIdsChange(new Set([node.id]));
        return;
      }

      onClearSelection();
      try {
        if (onNodeActivate) {
          onNodeActivate(node.id, node.data.url);
        } else {
          await navigateTo(node);
        }
      } catch (error) {
        console.error("Failed to navigate:", error);
      }
    },
    [
      editorActive,
      onClearSelection,
      onNodeActivate,
      onPickTargetComplete,
      onSelectedNodeIdsChange,
      pickTarget,
      tool,
    ],
  );

  const handleNodePointerDown = useCallback(
    (node: NavigationNode, info: PointerInfo) => {
      if (info.button !== 0) return;
      if (info.shiftKey) return;
      if (info.altKey) return;
      if (info.metaKey || info.ctrlKey) return;
      if (layoutOptions.mode === "radial" && node.isRoot?.()) return;
      const dragCandidates: NavigationNode[] = [];
      if (tree && selectedNodeIds.size > 1 && selectedNodeIds.has(node.id)) {
        selectedNodeIds.forEach((id) => {
          const candidate = tree.findNodeById(id);
          if (!candidate) return;
          let parent = candidate.getParent?.();
          let hasSelectedAncestor = false;
          while (parent) {
            if (selectedNodeIds.has(parent.id)) {
              hasSelectedAncestor = true;
              break;
            }
            parent = parent.getParent?.();
          }
          if (!hasSelectedAncestor) dragCandidates.push(candidate);
        });
      } else {
        dragCandidates.push(node);
      }
      const dragNodes =
        layoutOptions.mode === "radial"
          ? dragCandidates.filter((candidate) => !candidate.isRoot?.())
          : dragCandidates;
      if (dragNodes.length === 0) return;
      const nodes: DragNodeState[] = [];
      let rootCenterX = 0;
      let rootCenterY = 0;
      if (layoutOptions.mode === "radial") {
        if (!root) return;
        const rootPos = basePositions.get(root.id);
        if (!rootPos) return;
        rootCenterX = rootPos.x + nodeWidth / 2;
        rootCenterY = rootPos.y + nodeHeight / 2;
      }
      for (const dragNode of dragNodes) {
        const startPos = positions.get(dragNode.id);
        if (!startPos) continue;
        const startLayout = dragNode.data.layout;
        const baseOffsetX = typeof startLayout?.offsetX === "number" ? startLayout.offsetX : 0;
        const baseOffsetY = typeof startLayout?.offsetY === "number" ? startLayout.offsetY : 0;
        const entry: DragNodeState = {
          nodeId: dragNode.id,
          startNodeX: startPos.x,
          startNodeY: startPos.y,
          baseOffsetX,
          baseOffsetY,
        };
        if (layoutOptions.mode === "radial") {
          const basePos = basePositions.get(dragNode.id);
          if (!basePos) continue;
          const baseCenterX = basePos.x + nodeWidth / 2;
          const baseCenterY = basePos.y + nodeHeight / 2;
          const baseDx = baseCenterX - rootCenterX;
          const baseDy = baseCenterY - rootCenterY;
          const baseAngle = Math.atan2(baseDy, baseDx);
          const baseRadius = Math.hypot(baseDx, baseDy);
          let ancestorAngle = 0;
          let ancestorRadius = 0;
          let parent = dragNode.getParent?.();
          while (parent) {
            const radial = parent.data.layout?.radial;
            ancestorAngle += radial?.angleDelta ?? 0;
            ancestorRadius += radial?.radiusDelta ?? 0;
            parent = parent.getParent?.();
          }
          entry.radial = {
            rootCenterX,
            rootCenterY,
            baseAngle,
            baseRadius,
            ancestorAngle,
            ancestorRadius,
            minRadius: nodeWidth * 0.35,
          };
        }
        nodes.push(entry);
      }
      if (nodes.length === 0) return;
      dragMovedRef.current = false;
      dragStateRef.current = {
        startX: info.clientX,
        startY: info.clientY,
        mode: layoutOptions.mode,
        nodes,
        latestLayouts: new Map(),
      };

      // Pre-compute affected IDs for partial offset computation during drag.
      // Includes dragged subtrees + ancestors to root (offsets cascade parent->child).
      {
        const affected = new Set<NodeId>();
        for (const entry of nodes) {
          const draggedNode = tree?.findNodeById(entry.nodeId);
          if (!draggedNode) continue;
          // Add subtree
          const subtree = collectSubtreeIds(draggedNode);
          subtree.forEach((id) => affected.add(id));
          // Walk ancestors to root
          let ancestor = draggedNode.getParent?.();
          while (ancestor) {
            affected.add(ancestor.id);
            ancestor = ancestor.getParent?.();
          }
        }
        dragAffectedIdsRef.current = affected;
      }

      // Initialise reparent preview for single-node editor drags
      if (editorActive && nodes.length === 1) {
        const draggedNode = tree?.findNodeById(nodes[0]!.nodeId);
        const originalParent = draggedNode?.getParent?.();
        if (draggedNode && originalParent) {
          dragReparentRef.current = {
            draggedId: draggedNode.id,
            originalParentId: originalParent.id,
            targetId: null,
            subtreeIds: collectSubtreeIds(draggedNode),
          };
        }
      }

      const handleMove = (moveEvent: PointerEvent) => {
        const state = dragStateRef.current;
        if (!state) return;
        const { scale } = viewRef.current;
        const deltaX = (moveEvent.clientX - state.startX) / scale;
        const deltaY = (moveEvent.clientY - state.startY) / scale;
        if (!dragMovedRef.current && Math.hypot(deltaX, deltaY) > 3) {
          dragMovedRef.current = true;
          setIsDraggingNode(true);
          suppressClickRef.current = true;
        }
        if (!dragMovedRef.current) return;
        if (state.mode === "radial") {
          const layouts: LayoutUpdateMap = new Map();
          state.nodes.forEach((entry) => {
            if (!entry.radial) return;
            const targetCenterX = entry.startNodeX + deltaX + nodeWidth / 2;
            const targetCenterY = entry.startNodeY + deltaY + nodeHeight / 2;
            const desiredDx = targetCenterX - entry.radial.rootCenterX;
            const desiredDy = targetCenterY - entry.radial.rootCenterY;
            const desiredAngle = Math.atan2(desiredDy, desiredDx);
            const desiredRadius = Math.max(
              entry.radial.minRadius,
              Math.hypot(desiredDx, desiredDy),
            );
            const totalAngleDelta = desiredAngle - entry.radial.baseAngle;
            const totalRadiusDelta = desiredRadius - entry.radial.baseRadius;
            const nodeAngleDelta = totalAngleDelta - entry.radial.ancestorAngle;
            const nodeRadiusDelta = totalRadiusDelta - entry.radial.ancestorRadius;
            layouts.set(entry.nodeId, {
              radial: { angleDelta: nodeAngleDelta, radiusDelta: nodeRadiusDelta },
            });
          });
          state.latestLayouts = layouts;
          if (layouts.size > 0) {
            setDragPreview(layouts);
            queueLayoutUpdates(layouts);
          }
        } else {
          const layouts: LayoutUpdateMap = new Map();
          state.nodes.forEach((entry) => {
            const offsetX = entry.baseOffsetX + deltaX;
            const offsetY = entry.baseOffsetY + deltaY;
            layouts.set(entry.nodeId, { offsetX, offsetY });
          });
          state.latestLayouts = layouts;
          if (layouts.size > 0) {
            setDragPreview(layouts);
            queueLayoutUpdates(layouts);
          }
        }

        // --- Snap-to-parent proximity detection (editor mode) ---
        const rp = dragReparentRef.current;
        if (rp) {
          const entry = state.nodes[0]!;
          const dragCenterX = entry.startNodeX + deltaX + nodeWidth / 2;
          const dragCenterY = entry.startNodeY + deltaY + nodeHeight / 2;
          let bestId: NodeId | null = null;
          const renderer = rendererRef.current;
          if (renderer) {
            bestId = renderer.queryNearestNode(
              dragCenterX,
              dragCenterY,
              SNAP_RADIUS,
              rp.subtreeIds,
            );
          }
          if (rp.targetId !== bestId) {
            rp.targetId = bestId;
            setDragReparentTarget({
              draggedId: rp.draggedId,
              originalParentId: rp.originalParentId,
              targetId: bestId,
            });
          }
        }
      };

      const handleUp = async (_upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleUp);
        const state = dragStateRef.current;
        const didDrag = dragMovedRef.current;
        dragStateRef.current = null;
        dragAffectedIdsRef.current = null;
        prevDragPositionsRef.current = null;
        setIsDraggingNode(false);
        if (didDrag) {
          nodeDragJustEndedRef.current = true;
          suppressClickRef.current = true;
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        }
        if (!state) {
          dragMovedRef.current = false;
          setDragPreview(null);
          dragReparentRef.current = null;
          setDragReparentTarget(null);
          return;
        }
        if (!didDrag) {
          setDragPreview(null);
          dragReparentRef.current = null;
          setDragReparentTarget(null);
          return;
        }

        // Editor mode: use snap-based reparent preview
        const rp = dragReparentRef.current;
        dragReparentRef.current = null;
        setDragReparentTarget(null);

        if (rp) {
          // Cancel any pending throttled layout updates
          const sendState = layoutSendRef.current;
          if (sendState.timer !== null) {
            window.clearTimeout(sendState.timer);
            sendState.timer = null;
          }
          sendState.pending = null;

          if (rp.targetId) {
            // Drop onto snap target → reparent
            setDragPreview(null);
            dragMovedRef.current = false;

            // Clear stale layout offsets on the local tree
            if (tree) {
              const clearLayout = (n: NavigationNode) => {
                if (n.data.layout) {
                  const { layout: _, ...rest } = n.data;
                  n.data = rest as typeof n.data;
                }
                for (const child of n.getChildren()) clearLayout(child);
              };
              const draggedNode = tree.findNodeById(rp.draggedId);
              if (draggedNode) clearLayout(draggedNode);
            }

            try {
              await reparentNode(rp.draggedId, rp.targetId);
            } catch (error) {
              console.error("Reparent failed:", error);
            }
            return;
          } else {
            // No snap target → cancel drag, snap back to original position
            setDragPreview(null);
            dragMovedRef.current = false;
            return;
          }
        }

        const latestLayouts = state.latestLayouts;
        if (latestLayouts.size > 0) {
          const sendState = layoutSendRef.current;
          if (sendState.timer !== null) {
            window.clearTimeout(sendState.timer);
            sendState.timer = null;
          }
          sendState.pending = null;
          sendState.lastSent = performance.now();
          await flushLayoutUpdates(latestLayouts);

          // Apply the flushed layout values directly to the sidepanel tree's
          // node data so positions stay correct when dragPreview is cleared.
          // SET_NODE_LAYOUT only updates the background tree silently; without
          // this the sidepanel tree retains stale offsets and nodes snap back.
          if (tree) {
            latestLayouts.forEach((layout, nodeId) => {
              const treeNode = tree.findNodeById(nodeId);
              if (!treeNode) return;
              const prev = treeNode.data.layout;
              const prevOffsetX = prev?.offsetX ?? 0;
              const prevOffsetY = prev?.offsetY ?? 0;
              treeNode.data = {
                ...treeNode.data,
                layout: {
                  offsetX: typeof layout.offsetX === "number" ? layout.offsetX : prevOffsetX,
                  offsetY: typeof layout.offsetY === "number" ? layout.offsetY : prevOffsetY,
                  ...(layout.radial
                    ? { radial: layout.radial }
                    : prev?.radial
                      ? { radial: prev.radial }
                      : {}),
                },
              };
            });
          }
        }
        setDragPreview(null);
        dragMovedRef.current = false;
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp, { once: true });
      window.addEventListener("pointercancel", handleUp, { once: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutSendRef and viewRef are refs; selectedNodeIds intentionally omitted to avoid recreating pointer handlers on every selection change
    [
      basePositions,
      editorActive,
      flushLayoutUpdates,
      layoutOptions.mode,
      nodeHeight,
      nodeWidth,
      positions,
      queueLayoutUpdates,
      root,
      tree,
    ],
  );

  const handleNodeContextMenu = useCallback(
    (node: NavigationNode, clientX: number, clientY: number) => {
      if (selectedNodeIds.size > 0) {
        onOpenContextMenu({
          type: "bulk",
          nodeIds: Array.from(selectedNodeIds),
          position: { x: clientX, y: clientY },
        });
        return;
      }
      onOpenContextMenu({
        type: "node",
        nodeId: node.id,
        position: { x: clientX, y: clientY },
      });
    },
    [onOpenContextMenu, selectedNodeIds],
  );

  const handleWrapperContextMenu = (clientX: number, clientY: number) => {
    if (selectedNodeIds.size === 0) return;
    onOpenContextMenu({
      type: "bulk",
      nodeIds: Array.from(selectedNodeIds),
      position: { x: clientX, y: clientY },
    });
  };

  const renderNodes = useMemo<NodeRenderModel[]>(
    () =>
      profileSync("renderNodes", () => {
        const dimmedBySearch = searchActive;
        return visibleDisplayNodes.map((pos) => {
          const id = pos.node.id;
          const override = animatedPositionsRef.current.get(id);
          const x = override?.x ?? pos.x;
          const y = override?.y ?? pos.y;
          const tabState = tabStates[id];
          const isOpen = openNodeIds.has(id);
          const isSearchMatch = searchSet.has(id);
          return {
            id,
            node: pos.node,
            x,
            y,
            width: nodeWidth,
            height: nodeHeight,
            isCurrent: currentNodeId === id,
            isOpen,
            openProgress: display.dimClosedNodes
              ? (openProgressRef.current.get(id) ?? (isOpen ? 1 : 0))
              : 1,
            tabCount: nodeTabCounts[id] ?? 0,
            ...(tabState !== undefined ? { tabState } : {}),
            isCollapsed: collapsedNodeIds.has(id),
            isSelected: false,
            isPreview: false,
            isSearchMatch,
            isSearchFocused: focusedSearchId === id,
            isSearchDimmed: dimmedBySearch && !isSearchMatch,
            isHoverFocused: false,
            display,
          };
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animatedPositionsRef and openProgressRef are refs; animationVersion is the reactive trigger that re-evaluates their current values
    [
      animationVersion,
      currentNodeId,
      collapsedNodeIds,
      display,
      focusedSearchId,
      nodeHeight,
      nodeTabCounts,
      nodeWidth,
      openNodeIds,
      searchActive,
      searchSet,
      tabStates,
      visibleDisplayNodes,
    ],
  );

  // particleRenderModels is provided by useGraphAnimation hook.
  const pathNodeIds = useMemo(() => {
    if (!root || currentNodeId === null) return null;
    return getPathToNode(root, currentNodeId);
  }, [currentNodeId, root]);
  const connectionPositions = useMemo(() => {
    if (animatedPositionsRef.current.size === 0 && pendingEnterIds.size === 0) return positions;
    const next = new Map<NodeId, NodePosition>();
    positions.forEach((pos, id) => {
      if (pendingEnterIds.has(id)) return;
      const override = animatedPositionsRef.current.get(id);
      if (override) {
        next.set(id, { ...pos, x: override.x, y: override.y });
      } else {
        next.set(id, pos);
      }
    });
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animatedPositionsRef is a ref; animationVersion is the reactive trigger
  }, [animationVersion, pendingEnterIds, positions]);

  const baseConnections = useMemo(
    () => {
      const result = effectiveShowConnections
        ? profileSync("buildConnections", () =>
            buildConnections(
              root,
              positions,
              layoutOptions.mode,
              hideTreeRoot,
              nodeWidth,
              nodeHeight,
            ),
          )
        : [];
      cachedBaseConnectionsRef.current = result;
      return result;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staticVersion, effectiveShowConnections],
  );

  // Build an immutable GraphSnapshot capturing the full static state at layout time.
  // Re-created only when staticVersion increments (topology/layout/dimensions change).
  const snapshot = useMemo(
    () =>
      createGraphSnapshot({
        version: staticVersion,
        nodes: renderNodes,
        basePositions,
        connections: baseConnections,
        layoutMode: layoutOptions.mode,
        nodeWidth,
        nodeHeight,
        showConnections: effectiveShowConnections,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staticVersion],
  );
  snapshotRef.current = snapshot;

  // Apply path highlight as a flag toggle on cached base connections,
  // then layer drag-reparent preview edge on top.
  const connections = useMemo(() => {
    const withPath = applyPathHighlight(baseConnections, pathNodeIds);
    if (!dragReparentTarget) return withPath;
    const { draggedId, originalParentId, targetId } = dragReparentTarget;
    const excludeKey = `${originalParentId}-${draggedId}`;
    const filtered = withPath.filter((c) => c.id !== excludeKey);
    if (targetId) {
      const parentPos = connectionPositions.get(targetId);
      const childPos = connectionPositions.get(draggedId);
      if (parentPos && childPos) {
        let startX: number, startY: number, endX: number, endY: number;
        if (layoutOptions.mode === "tree") {
          startX = parentPos.x + nodeWidth / 2;
          startY = parentPos.y + nodeHeight;
          endX = childPos.x + nodeWidth / 2;
          endY = childPos.y;
        } else if (layoutOptions.mode === "mindmap") {
          const childOnRight = childPos.x >= parentPos.x;
          startX = parentPos.x + (childOnRight ? nodeWidth : 0);
          startY = parentPos.y + nodeHeight / 2;
          endX = childPos.x + (childOnRight ? 0 : nodeWidth);
          endY = childPos.y + nodeHeight / 2;
        } else {
          startX = parentPos.x + nodeWidth / 2;
          startY = parentPos.y + nodeHeight / 2;
          endX = childPos.x + nodeWidth / 2;
          endY = childPos.y + nodeHeight / 2;
        }
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        let cp1: { x: number; y: number };
        let cp2: { x: number; y: number };
        if (layoutOptions.mode === "tree") {
          cp1 = { x: startX, y: midY };
          cp2 = { x: endX, y: midY };
        } else if (layoutOptions.mode === "mindmap") {
          cp1 = { x: midX, y: startY };
          cp2 = { x: midX, y: endY };
        } else {
          cp1 = { x: midX, y: startY };
          cp2 = { x: midX, y: endY };
        }
        filtered.push({
          id: `preview-${targetId}-${draggedId}`,
          start: { x: startX, y: startY },
          cp1,
          cp2,
          end: { x: endX, y: endY },
          onPath: true, // highlight style for preview
          style: "bezier",
          bounds: {
            minX: Math.min(startX, endX, cp1.x, cp2.x),
            minY: Math.min(startY, endY, cp1.y, cp2.y),
            maxX: Math.max(startX, endX, cp1.x, cp2.x),
            maxY: Math.max(startY, endY, cp1.y, cp2.y),
          },
        });
      }
    }
    return filtered;
  }, [
    baseConnections,
    pathNodeIds,
    connectionPositions,
    dragReparentTarget,
    layoutOptions.mode,
    nodeHeight,
    nodeWidth,
  ]);

  // Snapshot render state for imperative animation path.
  // handleTickRenderRef.current reads this during RAF ticks to bypass React.
  latestRenderStateRef.current = {
    visibleDisplayNodes,
    positions,
    display,
    currentNodeId,
    openNodeIds,
    collapsedNodeIds,
    searchActive,
    searchSet,
    focusedSearchId,
    hoverNodeId,
    tabStates,
    nodeTabCounts,
    nodeWidth,
    nodeHeight,
    effectiveShowConnections,
    root,
    layoutMode: layoutOptions.mode,
    hideTreeRoot,
    pathNodeIds,
    snapshot,
  };

  // Static graph — fires only when topology/layout changes (snapshot recreated on staticVersion increment)
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const prevVersion = prevSnapshotVersionRef.current;
    prevSnapshotVersionRef.current = snapshot.version;

    // Use incremental patch when:
    // 1. We have a previous snapshot (not first render)
    // 2. Layout mode hasn't changed
    // 3. Node dimensions haven't changed
    // These conditions mean the change is collapse/expand or minor topology update
    if (
      prevVersion > 0 &&
      snapshot.layoutMode === renderer.currentSnapshot.layoutMode &&
      snapshot.nodeWidth === renderer.currentSnapshot.nodeWidth &&
      snapshot.nodeHeight === renderer.currentSnapshot.nodeHeight
    ) {
      renderer.patchStaticGraph(snapshot);
    } else {
      renderer.setStaticGraph(snapshot);
    }
  }, [snapshot]);

  // Dynamic state — fires on animation, search, openProgress changes
  useEffect(() => {
    rendererRef.current?.setDynamicState({
      nodes: renderNodes,
      connections,
      showConnections: effectiveShowConnections,
    });
  }, [renderNodes, connections, effectiveShowConnections]);

  // Hover — push directly to renderer, bypassing renderNodes rebuild
  useEffect(() => {
    rendererRef.current?.setHoverNodeId(hoverNodeId);
  }, [hoverNodeId]);

  // Particles — fires on particle updates
  useEffect(() => {
    rendererRef.current?.setParticles(particleRenderModels);
  }, [particleRenderModels, particleVersion]);

  useEffect(() => {
    rendererRef.current?.setDetailMode(detailMode);
  }, [detailMode]);

  useEffect(() => {
    rendererRef.current?.setConnectionQuality(connectionQuality);
  }, [connectionQuality]);

  useEffect(() => {
    rendererRef.current?.setMetricsListener(onRenderMetrics);
  }, [onRenderMetrics]);

  // getFitToViewView, fitToView, centerOnNode, zoom, zoomAt etc. are provided by useGraphView hook.

  // All view/camera functions (fitToView, centerOnNode, zoom, zoomAt, etc.)
  // and their effects are provided by useGraphView hook.

  // finalizeSelection and clearSelectionState are provided by useGraphSelection hook.

  const releasePointerCapture = (target: HTMLDivElement | null, pointerId: number | null) => {
    if (!target || pointerId === null) return;
    try {
      if (target.hasPointerCapture(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
    } catch {
      // ignore release errors
    }
  };

  const isGraphUiTarget = (target: HTMLElement) => target.closest('[data-graph-ui="true"]');

  const getPointerNodeId = (
    event: ReactPointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>,
  ) => {
    const wrapper = wrapperRef.current;
    const renderer = rendererRef.current;
    if (!wrapper || !renderer) return null;
    const rect = wrapper.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    return renderer.hitTestScreen(pointerX, pointerY);
  };

  const getPointerTarget = (
    event: ReactPointerEvent<HTMLDivElement> | ReactMouseEvent<HTMLDivElement>,
  ): PointerHitTarget | null => {
    const wrapper = wrapperRef.current;
    const renderer = rendererRef.current;
    if (!wrapper || !renderer) return null;
    const rect = wrapper.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    return renderer.hitTestTargetScreen(pointerX, pointerY);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (isGraphUiTarget(target)) return;
    if (!wrapperRef.current) return;
    cancelViewAnimation();
    suppressClickRef.current = false;
    nodeDragJustEndedRef.current = false;
    selectionDragRef.current = false;
    pointerDownNodeIdRef.current = null;
    pointerDownTargetRef.current = null;
    const rect = wrapperRef.current.getBoundingClientRect();
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const hitTarget = getPointerTarget(event);
    pointerDownTargetRef.current = hitTarget;
    const hitNodeId = hitTarget?.nodeId ?? null;
    pointerDownNodeIdRef.current = hitTarget?.target === "node" ? hitNodeId : null;
    if (hitTarget?.target === "collapse-icon") {
      return;
    }
    if (hitNodeId && tree) {
      const node = tree.findNodeById(hitNodeId);
      if (node) {
        handleNodePointerDown(node, event);
        return;
      }
    }

    if (tool === "hand") {
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        x: event.clientX - viewRef.current.translateX,
        y: event.clientY - viewRef.current.translateY,
      };
      panPointerStartRef.current = { x: event.clientX, y: event.clientY };
      panMovedRef.current = false;
    } else if (tool === "select") {
      selectionWorldRectRef.current = null;
      rendererRef.current?.clearSelectionPreview();
      const selectionMode = event.altKey ? "remove" : event.shiftKey ? "add" : "replace";
      selectionModeRef.current = selectionMode;
      if (selectionMode === "replace") {
        clearSelectionState();
      }
      isSelectingRef.current = true;
      const startX = event.clientX - rect.left;
      const startY = event.clientY - rect.top;
      selectionStartRef.current = { x: startX, y: startY };
      baseSelectionRef.current = selectionMode === "replace" ? new Set() : new Set(selectedNodeIds);
      updateSelectionBox({ left: startX, top: startY, width: 0, height: 0 });
      previewSelectionRef.current = new Set(baseSelectionRef.current);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!wrapperRef.current) return;
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== event.pointerId) {
      return;
    }
    if (isPanningRef.current) {
      const nextTranslateX = event.clientX - panStartRef.current.x;
      const nextTranslateY = event.clientY - panStartRef.current.y;
      if (!panMovedRef.current) {
        const dx = event.clientX - panPointerStartRef.current.x;
        const dy = event.clientY - panPointerStartRef.current.y;
        if (Math.hypot(dx, dy) > 3) {
          panMovedRef.current = true;
          suppressClickRef.current = true;
        }
      }
      scheduleGraphView({ translateX: nextTranslateX, translateY: nextTranslateY }, true);
      return;
    }
    if (isSelectingRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const left = Math.min(selectionStartRef.current.x, x);
      const top = Math.min(selectionStartRef.current.y, y);
      const width = Math.abs(x - selectionStartRef.current.x);
      const height = Math.abs(y - selectionStartRef.current.y);
      updateSelectionBox({ left, top, width, height });
      if (!selectionDragRef.current && (width > 3 || height > 3)) {
        selectionDragRef.current = true;
        suppressClickRef.current = true;
      }
      if (!selectionDragRef.current) return;
      const { translateX, translateY, scale } = viewRef.current;
      selectionWorldRectRef.current = {
        minX: (left - translateX) / scale,
        minY: (top - translateY) / scale,
        maxX: (left + width - translateX) / scale,
        maxY: (top + height - translateY) / scale,
      };
      scheduleSelectionPreview();
      return;
    }
    if (dragStateRef.current) return;

    const target = event.target as HTMLElement;
    if (isGraphUiTarget(target)) return;
    const hitNodeId = getPointerNodeId(event);
    if (hitNodeId !== lastHoverNodeIdRef.current) {
      lastHoverNodeIdRef.current = hitNodeId;
      // Push to renderer immediately for zero-latency visual feedback
      rendererRef.current?.setHoverNodeId(hitNodeId);
      // Debounce the Zustand write to avoid triggering React re-renders on every move
      if (hoverDebounceRef.current !== null) {
        clearTimeout(hoverDebounceRef.current);
      }
      hoverDebounceRef.current = setTimeout(() => {
        hoverDebounceRef.current = null;
        onSetHoverNodeId(hitNodeId);
      }, 80);
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== event.pointerId) {
      return;
    }
    releasePointerCapture(event.currentTarget, activePointerIdRef.current);
    activePointerIdRef.current = null;
    const downTarget = pointerDownTargetRef.current;
    pointerDownTargetRef.current = null;
    if (downTarget?.target === "collapse-icon") {
      const hitTarget = getPointerTarget(event);
      if (hitTarget?.target === "collapse-icon" && hitTarget.nodeId === downTarget.nodeId) {
        onExpandNodes([hitTarget.nodeId]);
      }
      return;
    }
    if (pointerDownNodeIdRef.current) {
      const nodeId = pointerDownNodeIdRef.current;
      pointerDownNodeIdRef.current = null;
      if (nodeDragJustEndedRef.current) {
        nodeDragJustEndedRef.current = false;
        dragMovedRef.current = false;
        return;
      }
      // If a node drag is still in progress (handleUp on window hasn't
      // processed the drag end yet), defer cleanup to handleUp so it can
      // read dragMovedRef correctly and run the full layout-commit path.
      if (dragStateRef.current && dragMovedRef.current) {
        return;
      }
      if (!dragMovedRef.current) {
        const node = tree?.findNodeById(nodeId);
        if (node) {
          handleNodeClick(node);
          suppressClickRef.current = true;
          window.setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        }
      } else {
        dragMovedRef.current = false;
      }
      return;
    }
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      panMovedRef.current = false;
      commitViewOnGestureEnd();
      if (suppressClickRef.current) {
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
      return;
    }
    if (isSelectingRef.current) {
      finalizeSelection();
      selectionDragRef.current = false;
      if (suppressClickRef.current) {
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
    }

    if (!isPanningRef.current && !isSelectingRef.current) {
      const nodeId = pointerDownNodeIdRef.current;
      pointerDownNodeIdRef.current = null;
      const wasDraggingNode =
        dragStateRef.current !== null || dragMovedRef.current || isDraggingNode;
      if (wasDraggingNode) {
        return;
      }
      if (nodeId && tree) {
        const node = tree.findNodeById(nodeId);
        if (node) {
          suppressClickRef.current = true;
          handleNodeClick(node);
        }
      }
    } else {
      pointerDownNodeIdRef.current = null;
    }
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== event.pointerId) {
      return;
    }
    releasePointerCapture(event.currentTarget, activePointerIdRef.current);
    activePointerIdRef.current = null;
    nodeDragJustEndedRef.current = false;
    pointerDownNodeIdRef.current = null;
    pointerDownTargetRef.current = null;
    dragMovedRef.current = false;
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      panMovedRef.current = false;
    }
    if (isSelectingRef.current) {
      finalizeSelection();
      selectionDragRef.current = false;
    }
    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    pointerDownNodeIdRef.current = null;
  };

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      cancelViewAnimation();
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const isTrackpadPinch = event.ctrlKey;
      const hasModifier = event.altKey || event.metaKey;
      const isMouseWheel = event.deltaMode === 1 || event.deltaMode === 2;
      const shouldZoom = isTrackpadPinch || hasModifier || isMouseWheel;
      if (shouldZoom) {
        const scaleFactor = isMouseWheel
          ? event.deltaY > 0
            ? 0.85
            : 1.18
          : 1 - event.deltaY * 0.005;
        zoomAt(pointerX, pointerY, scaleFactor);
      } else {
        scheduleGraphView(
          {
            translateX: viewRef.current.translateX - event.deltaX,
            translateY: viewRef.current.translateY - event.deltaY,
          },
          true,
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- viewRef and wrapperRef are refs, intentionally omitted
    [cancelViewAnimation, scheduleGraphView, zoomAt],
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onWheel = (event: WheelEvent) => handleWheel(event);
    wrapper.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      wrapper.removeEventListener("wheel", onWheel, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- wrapperRef is a ref, intentionally omitted
  }, [handleWheel, root]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const code = event.code;
    if (code === "Equal" || code === "NumpadAdd") {
      event.preventDefault();
      zoom("in", true);
    } else if (code === "Minus" || code === "NumpadSubtract") {
      event.preventDefault();
      zoom("out", true);
    } else if (code === "Digit0" || code === "Numpad0") {
      event.preventDefault();
      zoom("reset", true);
    } else if (code === "KeyH") {
      event.preventDefault();
      onGraphToolChange("hand");
      clearSelectionState();
    } else if (code === "KeyV") {
      event.preventDefault();
      onGraphToolChange("select");
      clearSelectionState();
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (pickTarget) {
        onPickTargetComplete();
        return;
      }
      clearSelectionState();
    }
  };

  const handleBackgroundClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (isGraphUiTarget(target)) return;
    if (getPointerNodeId(event)) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (pickTarget) {
      onPickTargetComplete();
      return;
    }
    clearSelectionState();
  };

  return (
    <div className="stack-container" id="stackContainer">
      <div
        className={cn("graph-wrapper", isDraggingNode && "is-dragging")}
        ref={wrapperRef}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => {
          lastHoverNodeIdRef.current = null;
          if (hoverDebounceRef.current !== null) {
            clearTimeout(hoverDebounceRef.current);
            hoverDebounceRef.current = null;
          }
          rendererRef.current?.setHoverNodeId(null);
          onSetHoverNodeId(null);
        }}
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => {
          event.preventDefault();
          const target = event.target as HTMLElement;
          if (isGraphUiTarget(target)) return;
          const nodeId = getPointerNodeId(event);
          if (nodeId && tree) {
            const node = tree.findNodeById(nodeId);
            if (node) {
              handleNodeContextMenu(node, event.clientX, event.clientY);
              return;
            }
          }
          handleWrapperContextMenu(event.clientX, event.clientY);
        }}
        onClick={handleBackgroundClick}
        style={{
          cursor: pickTarget
            ? "crosshair"
            : tool === "hand"
              ? isPanning
                ? "grabbing"
                : "grab"
              : hoverNodeId
                ? "pointer"
                : "default",
        }}
      >
        <div className="graph-canvas" ref={pixiHostRef} />
        <div
          ref={selectionBoxRef}
          className="graph-selection-box"
          style={{ opacity: 0, width: "0px", height: "0px" }}
        />
        {showControls && (
          <GraphZoomControls
            tool={tool}
            onToolChange={(nextTool) => {
              onGraphToolChange(nextTool);
              clearSelectionState();
            }}
            onZoom={(direction) => zoom(direction, true)}
            fullViewEnabled={fullViewEnabled}
            onOpenFullView={async () => {
              try {
                const fullViewUrl = runtimeGetURL("fullview.html");
                const existing = await browser.tabs.query({ url: fullViewUrl });
                const tab = existing.find((t) => t.active) ?? existing[0];
                if (tab?.id != null) {
                  if (tab.windowId != null) {
                    await browser.windows.update(tab.windowId, { focused: true });
                  }
                  await browser.tabs.update(tab.id, { active: true });
                  await browser.tabs.reload(tab.id);
                } else {
                  await browser.tabs.create({ url: fullViewUrl, active: true });
                }
              } catch (error) {
                console.error("Failed to open full view:", error);
              }
            }}
          />
        )}
        {pickTarget && (
          <div className="graph-pick-hint" data-graph-ui="true">
            <span>Click a node to duplicate to</span>
            <button type="button" onClick={onPickTargetComplete}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
