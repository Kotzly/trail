/**
 * Focus orchestrator — composes the cinematic camera arrival.
 *
 * Three transient annotations sit on top of the existing camera tween,
 * lifecycle classes, and selection state:
 *
 *   1. trailReactFlowIds — xyflow node ids on the active path from root
 *      → currentNodeId. Used by TrailGraph to mark ancestor edges with
 *      the `graph-edge--trail` class so off-trail edges can fade.
 *
 *   2. arrivingNodeId — the node that just became current. Set for
 *      ARRIVAL_DURATION_MS following each currentNodeId change so the
 *      node renders a one-shot scale pulse via focus.css.
 *
 *   3. forkParentIds — parents whose child just entered the layout.
 *      Set for FORK_PULSE_DURATION_MS so each parent renders a soft
 *      outward halo. The "branching genesis" beat — fork creation is
 *      the brand-defining act and the parent gets its own
 *      acknowledgement.
 *
 * The orchestrator is gated on FPS tier + reduced motion. When the
 * gate is off it returns empty annotations and zero work happens.
 *
 * Initial-mount behaviour: the first observation of layoutNodes
 * snapshots the id set without firing fork pulses — otherwise opening
 * the side panel would flash a halo on every parent in the tree at
 * once. Only diffs after the first render trigger pulses.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { NodeId } from "@shared/types/ids.js";
import type { TrailEdge, TrailNode } from "../types.js";
import { useFpsTier } from "./fps-tier.js";
import { useReducedMotion } from "./use-reduced-motion.js";

/** Pulse window: 200ms delay (camera mostly settled) + 360ms keyframe
 * + 40ms slack. focus.css holds the same delay + duration; the data
 * attribute must outlive the keyframe or the animation aborts mid-flight. */
const ARRIVAL_DURATION_MS = 600;
const FORK_PULSE_DURATION_MS = 380;
/** Matches the ink-draw keyframe duration in lifecycle.css (320ms) plus
 * one frame of slack so the animation always plays to completion. */
const GENESIS_EDGE_DURATION_MS = 340;
const EMPTY_NODE_IDS: ReadonlySet<NodeId> = new Set();
const EMPTY_RF_IDS: ReadonlySet<string> = new Set();
const EMPTY_EDGE_IDS: ReadonlySet<string> = new Set();

export function useFocusOrchestratorEnabled(): boolean {
  const tier = useFpsTier();
  const reduced = useReducedMotion();
  return tier !== "low" && !reduced;
}

export function useFocusOrchestrator({
  layoutNodes,
  layoutEdges,
  currentNodeId,
  enabled,
}: {
  layoutNodes: readonly TrailNode[];
  layoutEdges: readonly TrailEdge[];
  currentNodeId: NodeId | null;
  enabled: boolean;
}): {
  arrivingNodeId: NodeId | null;
  forkParentIds: ReadonlySet<NodeId>;
  trailReactFlowIds: ReadonlySet<string>;
  genesisEdgeIds: ReadonlySet<string>;
} {
  // ── Active trail ────────────────────────────────────────────────
  // Derive from `data.onActivePath` set by useGraphLayout. ReactFlow
  // ids (n.id) are what edges reference, so we collect those for the
  // edge classifier downstream.
  const trailReactFlowIds = useMemo<ReadonlySet<string>>(() => {
    if (!enabled || currentNodeId === null) return EMPTY_RF_IDS;
    const set = new Set<string>();
    for (const n of layoutNodes) {
      if (n.data.onActivePath) set.add(n.id);
    }
    return set;
  }, [enabled, layoutNodes, currentNodeId]);

  // ── Arrival pulse ───────────────────────────────────────────────
  // Single-slot state: only the most recent navigation pulses. If the
  // user fires three navigations in 200ms, the first two are coalesced
  // — the pulse always tracks the user's latest intent.
  const [arrivingNodeId, setArrivingNodeId] = useState<NodeId | null>(null);
  const arrivalTimerRef = useRef<number | null>(null);
  const lastArrivalForRef = useRef<NodeId | null>(null);

  // The pulse mirrors a transient prop change (currentNodeId) into local
  // state plus a timeout that clears it. setState-in-effect is the
  // correct pattern: we're reflecting an external value into a derived
  // ephemeral state, gated by a timer. The single cascading re-render
  // per navigation is what we want — it's how the pulse becomes visible.
  /* eslint-disable react-hooks/set-state-in-effect -- synchronizing prop → transient pulse state */
  useEffect(() => {
    if (!enabled || currentNodeId === null) {
      lastArrivalForRef.current = null;
      setArrivingNodeId(null);
      if (arrivalTimerRef.current !== null) {
        window.clearTimeout(arrivalTimerRef.current);
        arrivalTimerRef.current = null;
      }
      return;
    }
    if (lastArrivalForRef.current === currentNodeId) return;
    lastArrivalForRef.current = currentNodeId;
    setArrivingNodeId(currentNodeId);
    if (arrivalTimerRef.current !== null) {
      window.clearTimeout(arrivalTimerRef.current);
    }
    arrivalTimerRef.current = window.setTimeout(() => {
      setArrivingNodeId(null);
      arrivalTimerRef.current = null;
    }, ARRIVAL_DURATION_MS);
  }, [enabled, currentNodeId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(
    () => () => {
      if (arrivalTimerRef.current !== null) {
        window.clearTimeout(arrivalTimerRef.current);
      }
    },
    [],
  );

  // ── Fork-parent pulse + genesis-edge ink-draw ──────────────────
  // Detect newcomers via id-set diff against the previous render.
  // Skip the very first observation so we don't pulse every parent in
  // a freshly-opened tree. Look up each newcomer's parent via the
  // single edge whose `target` equals the newcomer's xyflow id —
  // layouts are forests so there's exactly one parent edge.
  //
  // The same parent-edge that supplies the parent for the halo also
  // becomes the "genesis edge" — the line that inks itself from
  // parent to child. We track its xyflow edge id and clear after the
  // ink-draw keyframe duration so subsequent edge updates don't keep
  // restarting the animation.
  const [forkParentIds, setForkParentIds] = useState<ReadonlySet<NodeId>>(EMPTY_NODE_IDS);
  const [genesisEdgeIds, setGenesisEdgeIds] = useState<ReadonlySet<string>>(EMPTY_EDGE_IDS);
  const prevDisplayIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const forkTimersRef = useRef<Map<NodeId, number>>(new Map());
  const edgeTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!enabled) {
      // Keep the prev-id set fresh so re-enabling doesn't fire stale
      // diffs as one giant fork burst.
      prevDisplayIdsRef.current = new Set(layoutNodes.map((n) => n.id));
      initializedRef.current = true;
      return;
    }

    const currentIds = new Set<string>();
    const idToNodeId = new Map<string, NodeId>();
    for (const n of layoutNodes) {
      currentIds.add(n.id);
      idToNodeId.set(n.id, n.data.nodeId);
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      prevDisplayIdsRef.current = currentIds;
      return;
    }

    const prevIds = prevDisplayIdsRef.current;
    const newcomers: string[] = [];
    for (const id of currentIds) {
      if (!prevIds.has(id)) newcomers.push(id);
    }
    prevDisplayIdsRef.current = currentIds;

    if (newcomers.length === 0) return;

    const newParents: NodeId[] = [];
    const newEdges: string[] = [];
    for (const newId of newcomers) {
      const parentEdge = layoutEdges.find((e) => e.target === newId);
      if (!parentEdge) continue;
      const parentNodeId = idToNodeId.get(parentEdge.source);
      if (parentNodeId === undefined) continue;
      newParents.push(parentNodeId);
      newEdges.push(parentEdge.id);
    }

    if (newParents.length > 0) {
      // Diff observation → ephemeral pulse state. setState-in-effect is
      // intentional: there is no synchronous render-time signal for
      // "this id was not in the previous render's set."
      // eslint-disable-next-line react-hooks/set-state-in-effect -- diff observation → transient pulse state
      setForkParentIds((prev) => {
        const next = new Set(prev);
        for (const id of newParents) next.add(id);
        return next;
      });

      for (const id of newParents) {
        const existing = forkTimersRef.current.get(id);
        if (existing !== undefined) window.clearTimeout(existing);
        const timer = window.setTimeout(() => {
          setForkParentIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          forkTimersRef.current.delete(id);
        }, FORK_PULSE_DURATION_MS);
        forkTimersRef.current.set(id, timer);
      }
    }

    if (newEdges.length > 0) {
      setGenesisEdgeIds((prev) => {
        const next = new Set(prev);
        for (const id of newEdges) next.add(id);
        return next;
      });

      for (const id of newEdges) {
        const existing = edgeTimersRef.current.get(id);
        if (existing !== undefined) window.clearTimeout(existing);
        const timer = window.setTimeout(() => {
          setGenesisEdgeIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          edgeTimersRef.current.delete(id);
        }, GENESIS_EDGE_DURATION_MS);
        edgeTimersRef.current.set(id, timer);
      }
    }
  }, [enabled, layoutNodes, layoutEdges]);

  useEffect(
    () => () => {
      for (const t of forkTimersRef.current.values()) window.clearTimeout(t);
      for (const t of edgeTimersRef.current.values()) window.clearTimeout(t);
      forkTimersRef.current.clear();
      edgeTimersRef.current.clear();
    },
    [],
  );

  return { arrivingNodeId, forkParentIds, trailReactFlowIds, genesisEdgeIds };
}
