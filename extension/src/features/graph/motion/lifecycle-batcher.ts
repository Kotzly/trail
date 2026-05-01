/**
 * Lifecycle event batcher (§0.3).
 *
 * When nodes enter, return, or exit in bursts (active browsing: 5 tabs
 * in 2 seconds), animating each independently produces a chaotic mix
 * of overlapping tweens. The batcher coalesces events inside a 300ms
 * window and emits them as a single staggered cohort.
 *
 * Queues are split by kind (`enter | return | exit`) because the
 * semantics are different: an entering node and a returning one look
 * different and must not be staggered together.
 *
 * Stagger step is kept short (30ms) — long staggers make the UI feel
 * slow (Emil: "stagger is decorative — never block interaction").
 */

export type LifecycleEventKind = "enter" | "return" | "exit";

export type LifecycleEvent<TId = string> = {
  id: TId;
  kind: LifecycleEventKind;
  /** Timestamp in ms (performance.now()). Used for TTL-based cleanup. */
  at: number;
};

export type LifecycleCohort<TId = string> = {
  kind: LifecycleEventKind;
  /**
   * Events in insertion order with their staggered offset in ms from
   * the cohort's flush instant. Consumers apply the offset via
   * `animation-delay` / `transition-delay` / setTimeout.
   */
  items: Array<{ id: TId; delayMs: number }>;
};

export type BatcherOptions = {
  /** Window during which events are coalesced, in ms. */
  windowMs?: number;
  /** Delay between staggered items within a cohort, in ms. */
  stepMs?: number;
  /**
   * Minimum cohort size before staggering kicks in. A single event
   * flushes immediately with delayMs = 0 — no artificial wait.
   */
  minCohortForStagger?: number;
};

const DEFAULTS: Required<BatcherOptions> = {
  windowMs: 300,
  stepMs: 30,
  minCohortForStagger: 3,
};

/**
 * Create a lifecycle-event batcher. Each call to `push` enqueues one
 * event; cohorts are flushed to `onFlush` on the trailing edge of the
 * window per kind.
 *
 * `dispose()` cancels pending timers — call it when the graph view
 * unmounts so we don't flush into a dead consumer.
 */
export function createLifecycleBatcher<TId = string>(
  onFlush: (cohort: LifecycleCohort<TId>) => void,
  options: BatcherOptions = {},
): {
  push: (event: LifecycleEvent<TId>) => void;
  flush: (kind?: LifecycleEventKind) => void;
  dispose: () => void;
} {
  const { windowMs, stepMs, minCohortForStagger } = { ...DEFAULTS, ...options };

  const queues: Record<LifecycleEventKind, LifecycleEvent<TId>[]> = {
    enter: [],
    return: [],
    exit: [],
  };
  const timers: Partial<Record<LifecycleEventKind, number>> = {};

  function flushKind(kind: LifecycleEventKind): void {
    const queue = queues[kind];
    if (queue.length === 0) return;
    queues[kind] = [];
    timers[kind] = undefined;

    const shouldStagger = queue.length >= minCohortForStagger;
    const cohort: LifecycleCohort<TId> = {
      kind,
      items: queue.map((event, index) => ({
        id: event.id,
        delayMs: shouldStagger ? index * stepMs : 0,
      })),
    };
    onFlush(cohort);
  }

  function push(event: LifecycleEvent<TId>): void {
    queues[event.kind].push(event);
    if (timers[event.kind] !== undefined) return;
    timers[event.kind] = window.setTimeout(() => flushKind(event.kind), windowMs);
  }

  function flush(kind?: LifecycleEventKind): void {
    if (kind) {
      if (timers[kind] !== undefined) {
        window.clearTimeout(timers[kind]);
        timers[kind] = undefined;
      }
      flushKind(kind);
      return;
    }
    for (const k of Object.keys(queues) as LifecycleEventKind[]) {
      if (timers[k] !== undefined) {
        window.clearTimeout(timers[k]);
        timers[k] = undefined;
      }
      flushKind(k);
    }
  }

  function dispose(): void {
    for (const k of Object.keys(timers) as LifecycleEventKind[]) {
      if (timers[k] !== undefined) {
        window.clearTimeout(timers[k]);
        timers[k] = undefined;
      }
      queues[k] = [];
    }
  }

  return { push, flush, dispose };
}
