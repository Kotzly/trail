/**
 * Node lifecycle hook.
 *
 * Detects nodes that have just entered or exited the layout list (e.g.
 * fresh navigation, deletion, collapse, expand) and annotates them
 * with a CSS class that triggers the keyframe animations in
 * `lifecycle.css`.
 *
 * Exit handling requires keeping departed nodes in the rendered list
 * for the animation duration — we hold them as "ghosts" with the
 * exiting class, then drop them once the animation has played.
 *
 * The hook is cheap by default: when the gate is off (flag, reduced
 * motion, low FPS tier), nodes pass through untouched and no diff or
 * timer work happens.
 *
 * Stagger: when several nodes enter or exit in the same React frame
 * (e.g. expand of a folded chain), each subsequent one gets a 30ms
 * `animation-delay` so the cohort cascades rather than flashing
 * together. Single-event cohorts have zero delay.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { TrailNode } from "../types.js";
import { useMotionFlag } from "./store.js";
import { useFpsTier } from "./fps-tier.js";
import { useReducedMotion } from "./use-reduced-motion.js";

const ENTER_DURATION_MS = 280;
const EXIT_DURATION_MS = 200;
const RETURN_DURATION_MS = 320;
const STAGGER_STEP_MS = 30;
const STAGGER_THRESHOLD = 3;
/** A node that disappears and reappears within this window is a "return". */
const RETURN_WINDOW_MS = 1500;

type Annotation = {
  kind: "enter" | "exit" | "return";
  delayMs: number;
  expiresAt: number;
  /** Snapshot held only for exits — we render this from the ghost list. */
  ghost?: TrailNode;
};

/**
 * Combined gate: lifecycle animations only fire when at least one of
 * the lifecycle flags is on, FPS tier is decent, and the user hasn't
 * requested reduced motion. The `low` tier bails — entry/exit on a
 * struggling device just compounds jank.
 */
export function useNodeLifecycleEnabled(): boolean {
  const enterFlag = useMotionFlag("lifecycle_node_enter");
  const exitFlag = useMotionFlag("lifecycle_node_exit");
  const tier = useFpsTier();
  const reduced = useReducedMotion();
  return (enterFlag || exitFlag) && tier !== "low" && !reduced;
}

export function useNodeLifecycle(nodes: readonly TrailNode[], enabled: boolean): TrailNode[] {
  const annotationsRef = useRef<Map<string, Annotation>>(new Map());
  const lastSnapshotRef = useRef<Map<string, TrailNode>>(new Map());
  const recentlyDepartedRef = useRef<Map<string, number>>(new Map());
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [, setTick] = useState(0);

  const result = useMemo(() => {
    if (!enabled) {
      annotationsRef.current.clear();
      lastSnapshotRef.current.clear();
      recentlyDepartedRef.current.clear();
      prevIdsRef.current = new Set(nodes.map((n) => n.id));
      return nodes as TrailNode[];
    }

    // Animation cohort timestamps need a monotonic clock read each render —
    // the bookkeeping is intentionally time-dependent.
    // eslint-disable-next-line react-hooks/purity
    const now = performance.now();
    const currentIds = new Set(nodes.map((n) => n.id));
    const prevIds = prevIdsRef.current;

    // Bootstrap paint: every node is "new" only because we just
    // mounted. Treating the cohort as `entering` triggers 1 CSS
    // animation per node + a style recalc/layout-tree cascade — on a
    // 5k+ tree that adds ~5s of main-thread work for what is
    // semantically not an entry event. Pass through unchanged on the
    // very first render; seed prevIdsRef so subsequent diffs work.
    if (prevIds.size === 0 && currentIds.size > 0) {
      for (const node of nodes) lastSnapshotRef.current.set(node.id, node);
      prevIdsRef.current = currentIds;
      return nodes as TrailNode[];
    }

    // Classify newcomers — entering vs returning.
    const enteringIds: string[] = [];
    const returningIds: string[] = [];
    for (const id of currentIds) {
      if (prevIds.has(id)) continue;
      const departedAt = recentlyDepartedRef.current.get(id);
      if (departedAt !== undefined && now - departedAt < RETURN_WINDOW_MS) {
        returningIds.push(id);
        recentlyDepartedRef.current.delete(id);
      } else {
        enteringIds.push(id);
      }
      // An id that re-appears clears any stale exit annotation.
      const stale = annotationsRef.current.get(id);
      if (stale?.kind === "exit") annotationsRef.current.delete(id);
    }

    // Classify exiters — must have a snapshot to render their ghost.
    const exitingIds: string[] = [];
    for (const id of prevIds) {
      if (currentIds.has(id)) continue;
      const ghost = lastSnapshotRef.current.get(id);
      if (!ghost) continue;
      exitingIds.push(id);
      recentlyDepartedRef.current.set(id, now);
    }

    // Apply stagger only when the cohort is dense enough to warrant it.
    const enterStagger = enteringIds.length >= STAGGER_THRESHOLD ? STAGGER_STEP_MS : 0;
    const returnStagger = returningIds.length >= STAGGER_THRESHOLD ? STAGGER_STEP_MS : 0;
    const exitStagger = exitingIds.length >= STAGGER_THRESHOLD ? STAGGER_STEP_MS : 0;

    enteringIds.forEach((id, index) => {
      annotationsRef.current.set(id, {
        kind: "enter",
        delayMs: index * enterStagger,
        expiresAt: now + index * enterStagger + ENTER_DURATION_MS + 16,
      });
    });
    returningIds.forEach((id, index) => {
      annotationsRef.current.set(id, {
        kind: "return",
        delayMs: index * returnStagger,
        expiresAt: now + index * returnStagger + RETURN_DURATION_MS + 16,
      });
    });
    exitingIds.forEach((id, index) => {
      const ghost = lastSnapshotRef.current.get(id);
      if (!ghost) return;
      annotationsRef.current.set(id, {
        kind: "exit",
        delayMs: index * exitStagger,
        expiresAt: now + index * exitStagger + EXIT_DURATION_MS + 16,
        ghost,
      });
    });

    // Refresh the snapshot cache for currently-visible nodes — these
    // are what we'll render as ghosts on the next exit. Trim ids no
    // longer present after the exit window so the map doesn't grow
    // unbounded.
    for (const node of nodes) lastSnapshotRef.current.set(node.id, node);
    for (const id of lastSnapshotRef.current.keys()) {
      if (!currentIds.has(id) && !annotationsRef.current.has(id)) {
        lastSnapshotRef.current.delete(id);
      }
    }

    // Trim trackers.
    for (const [id, ts] of recentlyDepartedRef.current) {
      if (now - ts > RETURN_WINDOW_MS) recentlyDepartedRef.current.delete(id);
    }
    for (const [id, ann] of annotationsRef.current) {
      if (ann.expiresAt <= now) annotationsRef.current.delete(id);
    }

    // Compose output: live nodes (with optional entering/returning
    // class) plus ghost nodes (with exiting class).
    const out: TrailNode[] = [];
    for (const node of nodes) {
      const ann = annotationsRef.current.get(node.id);
      if (!ann || ann.kind === "exit") {
        out.push(node);
      } else {
        out.push({
          ...node,
          className: mergeClass(node.className, classFor(ann.kind)),
          style: { ...(node.style ?? {}), animationDelay: `${ann.delayMs}ms` },
        });
      }
    }
    for (const [id, ann] of annotationsRef.current) {
      if (ann.kind !== "exit") continue;
      if (currentIds.has(id)) continue;
      if (!ann.ghost) continue;
      out.push({
        ...ann.ghost,
        className: mergeClass(ann.ghost.className, "graph-node--exiting"),
        style: { ...(ann.ghost.style ?? {}), animationDelay: `${ann.delayMs}ms` },
        selectable: false,
        draggable: false,
      });
    }

    prevIdsRef.current = currentIds;
    return out;
  }, [nodes, enabled]);

  // Schedule a re-render to retire expired annotations once the
  // longest possible animation has played. Depend on annotation count
  // so the effect re-arms whenever we add a fresh cohort.
  const annotationCount = annotationsRef.current.size;
  useEffect(() => {
    if (annotationCount === 0) return undefined;
    const timer = window.setTimeout(
      () => setTick((t) => t + 1),
      ENTER_DURATION_MS + STAGGER_STEP_MS * 4 + 32,
    );
    return () => window.clearTimeout(timer);
  }, [annotationCount]);

  return result;
}

function classFor(kind: Annotation["kind"]): string {
  switch (kind) {
    case "enter":
      return "graph-node--entering";
    case "exit":
      return "graph-node--exiting";
    case "return":
      return "graph-node--returning";
  }
}

function mergeClass(existing: string | undefined, addition: string): string {
  if (!existing) return addition;
  return `${existing} ${addition}`;
}
