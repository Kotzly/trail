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
 *
 * ## Architecture
 *
 * Diff bookkeeping lives in a single `useState` slot. Bookkeeping
 * transitions happen inside a `useLayoutEffect` — running after the
 * commit, before paint — so the resulting re-render (with annotation
 * classes attached) flushes synchronously and the browser only ever
 * paints the final state. Render itself is pure: it derives the
 * output from `nodes` + `state.annotations` with no impurity.
 *
 * Pure helpers `composeOutput`, `computeNextDiffState`, and
 * `retireExpired` make the state transitions testable in isolation
 * and keep the React surface area minimal.
 */

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
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
/** Worst-case animation lifetime — used as the expiry-sweep deadline. */
const MAX_LIFETIME_MS = ENTER_DURATION_MS + STAGGER_STEP_MS * 4 + 32;

type Annotation = {
  kind: "enter" | "exit" | "return";
  delayMs: number;
  expiresAt: number;
  /** Snapshot held only for exits — we render this from the ghost list. */
  ghost?: TrailNode;
};

type DiffState = {
  annotations: Map<string, Annotation>;
  lastSnapshots: Map<string, TrailNode>;
  recentlyDeparted: Map<string, number>;
  prevIds: Set<string>;
};

const EMPTY_ANNOTATIONS: Map<string, Annotation> = new Map();
const EMPTY_SNAPSHOTS: Map<string, TrailNode> = new Map();
const EMPTY_RECENTLY_DEPARTED: Map<string, number> = new Map();
const EMPTY_PREV_IDS: Set<string> = new Set();

const INITIAL_STATE: DiffState = {
  annotations: EMPTY_ANNOTATIONS,
  lastSnapshots: EMPTY_SNAPSHOTS,
  recentlyDeparted: EMPTY_RECENTLY_DEPARTED,
  prevIds: EMPTY_PREV_IDS,
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
  const [state, setState] = useState<DiffState>(INITIAL_STATE);

  // PURE: derive the rendered list from `nodes` + the cohort
  // annotations. When the gate is off we short-circuit to the
  // original array (same ref) so the no-op path has zero allocations.
  const output = useMemo<TrailNode[]>(
    () => (enabled ? composeOutput(nodes, state.annotations) : (nodes as TrailNode[])),
    [nodes, state.annotations, enabled],
  );

  // SIDE-EFFECT: whenever `nodes` or `enabled` changes, diff against
  // the previous render's snapshot and dispatch the next state. Using
  // a layout effect (rather than a passive effect) makes the resulting
  // re-render flush BEFORE paint, so animation classes always land
  // same-frame-as-arrival.
  //
  // The lint rule prefers deriving state during render, but we can't
  // do that here: ghost rendering carries the LAST-COMMITTED snapshot
  // of departed nodes, and that snapshot is genuine state (the parent
  // no longer exposes those nodes in `nodes`). The next-state pass
  // is a pure function of (prev state, current nodes, monotonic now),
  // which is exactly what useLayoutEffect + setState models.
  /* eslint-disable react-hooks/set-state-in-effect -- pure diff-against-previous-commit */
  useLayoutEffect(() => {
    if (!enabled) {
      setState((prev) => resetForDisabled(prev, nodes));
      return;
    }
    setState((prev) => computeNextDiffState(prev, nodes, performance.now()));
  }, [nodes, enabled]);

  // Re-arm a single setTimeout that retires expired annotations. New
  // cohort → new `state.annotations` reference → effect re-runs.
  useEffect(() => {
    if (state.annotations.size === 0) return undefined;
    const timer = window.setTimeout(
      () => setState((prev) => retireExpired(prev, performance.now())),
      MAX_LIFETIME_MS,
    );
    return () => window.clearTimeout(timer);
  }, [state.annotations]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return output;
}

// ── Pure helpers ─────────────────────────────────────────────────────

function composeOutput(
  nodes: readonly TrailNode[],
  annotations: Map<string, Annotation>,
): TrailNode[] {
  if (annotations.size === 0) return nodes as TrailNode[];

  const out: TrailNode[] = [];
  const liveIds = new Set<string>();
  for (const node of nodes) {
    liveIds.add(node.id);
    const ann = annotations.get(node.id);
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
  for (const [id, ann] of annotations) {
    if (ann.kind !== "exit") continue;
    if (liveIds.has(id)) continue;
    if (!ann.ghost) continue;
    out.push({
      ...ann.ghost,
      className: mergeClass(ann.ghost.className, "graph-node--exiting"),
      style: { ...(ann.ghost.style ?? {}), animationDelay: `${ann.delayMs}ms` },
      selectable: false,
      draggable: false,
    });
  }
  return out;
}

function computeNextDiffState(
  prev: DiffState,
  nodes: readonly TrailNode[],
  now: number,
): DiffState {
  const currentIds = new Set<string>();
  for (const n of nodes) currentIds.add(n.id);
  const prevIds = prev.prevIds;

  // Bootstrap paint: every node is "new" only because we just mounted.
  // Treating the cohort as `entering` triggers 1 CSS animation per
  // node + a style recalc/layout-tree cascade — on a 5k+ tree that's
  // ~5s of main-thread work for what is semantically not an entry
  // event. Pass through unchanged on the very first render; seed
  // prevIds so subsequent diffs work.
  if (prevIds.size === 0 && currentIds.size > 0) {
    const lastSnapshots = new Map<string, TrailNode>();
    for (const node of nodes) lastSnapshots.set(node.id, node);
    return {
      annotations: prev.annotations,
      lastSnapshots,
      recentlyDeparted: prev.recentlyDeparted,
      prevIds: currentIds,
    };
  }

  const annotations = new Map(prev.annotations);
  const lastSnapshots = new Map(prev.lastSnapshots);
  const recentlyDeparted = new Map(prev.recentlyDeparted);

  // Classify newcomers — entering vs returning.
  const enteringIds: string[] = [];
  const returningIds: string[] = [];
  for (const id of currentIds) {
    if (prevIds.has(id)) continue;
    const departedAt = recentlyDeparted.get(id);
    if (departedAt !== undefined && now - departedAt < RETURN_WINDOW_MS) {
      returningIds.push(id);
      recentlyDeparted.delete(id);
    } else {
      enteringIds.push(id);
    }
    // An id that re-appears clears any stale exit annotation.
    const stale = annotations.get(id);
    if (stale?.kind === "exit") annotations.delete(id);
  }

  // Classify exiters — must have a snapshot to render their ghost.
  const exitingIds: string[] = [];
  for (const id of prevIds) {
    if (currentIds.has(id)) continue;
    const ghost = lastSnapshots.get(id);
    if (!ghost) continue;
    exitingIds.push(id);
    recentlyDeparted.set(id, now);
  }

  // Stagger only when the cohort is dense enough to warrant it.
  const enterStagger = enteringIds.length >= STAGGER_THRESHOLD ? STAGGER_STEP_MS : 0;
  const returnStagger = returningIds.length >= STAGGER_THRESHOLD ? STAGGER_STEP_MS : 0;
  const exitStagger = exitingIds.length >= STAGGER_THRESHOLD ? STAGGER_STEP_MS : 0;

  enteringIds.forEach((id, index) => {
    annotations.set(id, {
      kind: "enter",
      delayMs: index * enterStagger,
      expiresAt: now + index * enterStagger + ENTER_DURATION_MS + 16,
    });
  });
  returningIds.forEach((id, index) => {
    annotations.set(id, {
      kind: "return",
      delayMs: index * returnStagger,
      expiresAt: now + index * returnStagger + RETURN_DURATION_MS + 16,
    });
  });
  exitingIds.forEach((id, index) => {
    const ghost = lastSnapshots.get(id);
    if (!ghost) return;
    annotations.set(id, {
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
  for (const node of nodes) lastSnapshots.set(node.id, node);
  for (const id of lastSnapshots.keys()) {
    if (!currentIds.has(id) && !annotations.has(id)) {
      lastSnapshots.delete(id);
    }
  }

  for (const [id, ts] of recentlyDeparted) {
    if (now - ts > RETURN_WINDOW_MS) recentlyDeparted.delete(id);
  }
  for (const [id, ann] of annotations) {
    if (ann.expiresAt <= now) annotations.delete(id);
  }

  return { annotations, lastSnapshots, recentlyDeparted, prevIds: currentIds };
}

function retireExpired(prev: DiffState, now: number): DiffState {
  if (prev.annotations.size === 0) return prev;
  let nextAnnotations: Map<string, Annotation> | null = null;
  for (const [id, ann] of prev.annotations) {
    if (ann.expiresAt <= now) {
      if (nextAnnotations === null) nextAnnotations = new Map(prev.annotations);
      nextAnnotations.delete(id);
    }
  }
  if (nextAnnotations === null) return prev;
  return { ...prev, annotations: nextAnnotations };
}

function resetForDisabled(prev: DiffState, nodes: readonly TrailNode[]): DiffState {
  if (prev.annotations.size === 0 && nodes.length === prev.prevIds.size) {
    let allMatch = true;
    for (const n of nodes) {
      if (!prev.prevIds.has(n.id)) {
        allMatch = false;
        break;
      }
    }
    if (allMatch && prev.lastSnapshots.size === 0 && prev.recentlyDeparted.size === 0) {
      return prev;
    }
  }
  const prevIds = new Set<string>();
  for (const n of nodes) prevIds.add(n.id);
  return {
    annotations: EMPTY_ANNOTATIONS,
    lastSnapshots: EMPTY_SNAPSHOTS,
    recentlyDeparted: EMPTY_RECENTLY_DEPARTED,
    prevIds,
  };
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
