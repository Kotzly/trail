import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLatest } from "@ui/hooks/use-latest";
import type { NodeId } from "@shared/types/ids.js";
import type { NavigationTreeJSON } from "@shared/types/tree.js";
import type { NavigationNodeJSON } from "@shared/types/node.js";
import { useCameraControls } from "../motion/useCameraControls.js";
import { useMotionFlag } from "../motion/store.js";
import { NODE_WIDTH, NODE_HEIGHT } from "../tree-layout.js";

type UseCameraCenteringInput = {
  tree: NavigationTreeJSON | null;
  currentNodeId: NodeId | null;
  /** Per-node position lookup from the current layout. */
  positions: Map<string, { x: number; y: number }>;
  /** Settings-driven layout mode; switches reset the "resolved" marker. */
  layoutMode: string;
  /** True once the layout has rendered at least one node. */
  hasNodes: boolean;
};

type UseCameraCenteringResult = {
  /**
   * Toolbar-button callback: pan to the current node when there is one,
   * otherwise pan to the fallback focus (last-visited node, else root).
   * Preserves current zoom. Backs the "Focus current node" button which
   * always has a useful target — degrading gracefully when no tab is
   * active or its layout position hasn't landed yet.
   */
  focusCurrentOrFallback: () => void;
  /** True iff either the current node or the fallback has a layout position. */
  canFocus: boolean;
  /**
   * Marker for distinguishing extension-initiated clicks from external
   * navigation. The click handler calls this BEFORE invoking the
   * navigation; when the subsequent `currentNodeId` change matches,
   * the centering effect knows the user clicked a node in the
   * extension (rather than navigating externally via the browser).
   */
  markExtensionClick: (nodeId: NodeId) => void;
};

/**
 * Camera-centering orchestrator.
 *
 * Policy:
 *   1. Initial mount (sidepanel opens) — center on the current node,
 *      or on the fallback focus (last-visited, else root) when there's
 *      no current tab or its position hasn't landed yet. Auto-fitView
 *      was removed — full-graph framing is a user-only action via the
 *      GraphControls button.
 *   2. Subsequent external navigation (browser-initiated: user clicks a
 *      link on a page, opens a new tab, or the tab navigates itself) —
 *      always center on the new current node.
 *   3. Subsequent extension-initiated click — only center if the
 *      `camera_follow_click` flag is on. Extension click is detected
 *      via `expectedClickNodeId` matching the new `currentNodeId`.
 *   4. Layout mode switch — re-center on current node.
 *
 * Position may be null on the very first pass for a new node (tree
 * update arrives before the geometry memo recomputes). The effect
 * simply waits: when `targetX`/`targetY` transition null → numbers,
 * it re-fires with the newly-available coordinates and centers. The
 * `resolvedForIdRef` guard ensures one commit per `currentNodeId`
 * change, so churn elsewhere doesn't trigger repeated re-centers.
 */
export function useCameraCentering(input: UseCameraCenteringInput): UseCameraCenteringResult {
  const { tree, currentNodeId, positions, layoutMode, hasNodes } = input;
  const { smoothCenter } = useCameraControls();
  const followClickEnabled = useMotionFlag("camera_follow_click");

  const initialFitDone = useRef(false);
  // Marker for distinguishing extension clicks from external navigation:
  // see `markExtensionClick` JSDoc.
  const expectedClickNodeId = useRef<NodeId | null>(null);
  // Last `currentNodeId` we've already resolved (centered on or explicitly
  // skipped). Prevents re-centering when the layout array identity churns
  // but the target stays the same, while still allowing us to wait until
  // the async layout produces a position for a freshly-arrived node.
  const resolvedForIdRef = useRef<NodeId | null>(null);

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

  // Target position for `currentNodeId` — null when the node hasn't
  // reached the layout yet (e.g. brand-new tab that arrives just before
  // the geometry memo recomputes). O(1) Map.get into the layout's
  // position lookup; primitive x/y deps below mean the centering
  // effect refires exactly once when the position lands, not on every
  // re-render.
  const targetPos = currentNodeId !== null ? (positions.get(String(currentNodeId)) ?? null) : null;
  const targetX = targetPos?.x ?? null;
  const targetY = targetPos?.y ?? null;

  // Position of the initial-mount fallback (last-visited or root). Same
  // O(1) read from the layout's position map.
  const fallbackPos =
    fallbackFocusId !== null ? (positions.get(String(fallbackFocusId)) ?? null) : null;
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
  }, [layoutMode]);

  useEffect(() => {
    if (!hasNodes) return;
    const { smoothCenter: latestSmoothCenter, followClickEnabled: latestFollowClick } =
      latest.current;

    if (!currentNodeId) {
      // User closed the current tab or we're between tabs. Clear the
      // "resolved" marker so if the user lands back on the same node id
      // later, we re-center instead of short-circuiting.
      resolvedForIdRef.current = null;
      if (!initialFitDone.current && fallbackX !== null && fallbackY !== null) {
        initialFitDone.current = true;
        latestSmoothCenter(fallbackX + NODE_WIDTH / 2, fallbackY + NODE_HEIGHT / 2);
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
        latestSmoothCenter(fallbackX + NODE_WIDTH / 2, fallbackY + NODE_HEIGHT / 2);
      }
      return;
    }

    const wasClicked = expectedClickNodeId.current === currentNodeId;
    expectedClickNodeId.current = null;
    resolvedForIdRef.current = currentNodeId;

    const isInitial = !initialFitDone.current;
    initialFitDone.current = true;

    const shouldCenter = isInitial || !wasClicked || latestFollowClick;
    if (shouldCenter) {
      latestSmoothCenter(targetX + NODE_WIDTH / 2, targetY + NODE_HEIGHT / 2);
    }
  }, [currentNodeId, hasNodes, targetX, targetY, fallbackX, fallbackY, latest]);

  // Explicit "focus" action from the toolbar. Pans to the current node
  // and resets zoom to 1× — a known, readable reading level regardless
  // of where the user wandered. Falls back to the last-visited / root
  // node when no current tab is laid out yet.
  const focusCurrentOrFallback = useCallback(() => {
    if (targetX !== null && targetY !== null) {
      smoothCenter(targetX + NODE_WIDTH / 2, targetY + NODE_HEIGHT / 2, { zoom: 1 });
      return;
    }
    if (fallbackX !== null && fallbackY !== null) {
      smoothCenter(fallbackX + NODE_WIDTH / 2, fallbackY + NODE_HEIGHT / 2, { zoom: 1 });
    }
  }, [targetX, targetY, fallbackX, fallbackY, smoothCenter]);

  const canFocus =
    (targetX !== null && targetY !== null) || (fallbackX !== null && fallbackY !== null);

  const markExtensionClick = useCallback((nodeId: NodeId) => {
    expectedClickNodeId.current = nodeId;
  }, []);

  return { focusCurrentOrFallback, canFocus, markExtensionClick };
}
