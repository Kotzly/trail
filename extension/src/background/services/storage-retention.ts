import { Mutex } from "async-mutex";
import { isTreeStub, type TreeIndexEntry } from "@shared/types/tree.js";

/**
 * Quota constants — chrome.storage.local default is 10 MB
 * (10_485_760 bytes; raised from 5 MB in Chrome 114+). Manifest
 * does NOT request `unlimitedStorage`, so this is the real ceiling.
 *
 * Sweep policy:
 *   usage >= HIGH_WATER  → start stubbing oldest-by-lastOpenedAt
 *   usage <  LOW_WATER   → stop stubbing
 *
 * Hysteresis (75% / 60%) avoids flapping if a single push grows the
 * blob just past threshold.
 */
const QUOTA_BYTES = 10 * 1024 * 1024;
const HIGH_WATER = Math.floor(0.75 * QUOTA_BYTES);
const LOW_WATER = Math.floor(0.6 * QUOTA_BYTES);
const PROBE_THROTTLE_MS = 60_000;
const MAX_STUBS_PER_SWEEP = 10;

const sweepMutex = new Mutex();
let lastProbeAt = 0;

export type RetentionDeps = {
  getBytesInUse: () => Promise<number>;
  isSignedIn: () => boolean;
  getActiveId: () => Promise<string>;
  getIndex: () => Promise<TreeIndexEntry[]>;
  /** Returns one of: "ok" | "skipped" | "conflict" | "offline" | "error" | "rate_limited". */
  pushTree: (treeId: string) => Promise<string>;
  deleteBlob: (treeId: string) => Promise<void>;
  stubEntry: (treeId: string) => Promise<void>;
  notifyUpdate: () => Promise<void>;
  now: () => number;
};

let deps: RetentionDeps | null = null;
let logger: { info: Log; warn: Log; error: Log } = silentLogger();

type Log = (msg: string, fields?: Record<string, unknown>) => void;

function silentLogger() {
  const noop: Log = () => {};
  return { info: noop, warn: noop, error: noop };
}

/**
 * Wire up the retention module. Call once during SW startup with the
 * production dependencies; tests pass mocked deps directly. Pass
 * `null` to clear (also resets throttle state).
 */
export function setRetentionDeps(next: RetentionDeps | null): void {
  deps = next;
}

export function setRetentionLogger(log: typeof logger | null): void {
  logger = log ?? silentLogger();
}

export function resetRetentionState(): void {
  lastProbeAt = 0;
}

/**
 * Fire-and-forget probe. Triggered by `chrome.storage.onChanged` after
 * any tree-related write. Throttled to one probe per
 * PROBE_THROTTLE_MS so a burst of writes doesn't hammer the quota
 * API. Returns nothing — errors are swallowed and logged.
 */
export function maybeReclaimStorage(): void {
  void runProbe().catch((error) => {
    logger.error("probe failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

async function runProbe(): Promise<void> {
  if (!deps) return;
  const now = deps.now();
  if (now - lastProbeAt < PROBE_THROTTLE_MS) return;
  if (!deps.isSignedIn()) return;

  let usage: number;
  try {
    usage = await deps.getBytesInUse();
  } catch (error) {
    logger.warn("getBytesInUse failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  if (usage < HIGH_WATER) return;

  // Mark probe time only when we actually decide to act. Failed
  // probes (signed-out, quota query error) shouldn't burn the
  // throttle window — recovery happens on the next storage write.
  lastProbeAt = now;
  logger.info("reclaim probe", { usage, highWater: HIGH_WATER });
  await runReclaimSweep();
}

export type SweepResult = {
  stubbed: string[];
  reason?: "below-low-water" | "max-stubs" | "no-candidates" | "signed-out" | "not-wired";
};

/**
 * Run the reclaim sweep. Picks oldest-by-lastOpenedAt non-stub
 * non-active trees and stubs them until usage drops below
 * LOW_WATER, or MAX_STUBS_PER_SWEEP is hit, or no candidates
 * remain. Each stub is gated through the injected `pushTree` —
 * trees with conflicts, offline state, or rate-limit responses
 * are skipped (not retried inline).
 *
 * Serialized via `sweepMutex` so concurrent triggers don't race.
 */
export async function runReclaimSweep(): Promise<SweepResult> {
  return sweepMutex.runExclusive(async () => {
    if (!deps) return { stubbed: [], reason: "not-wired" as const };
    const d = deps;
    if (!d.isSignedIn()) return { stubbed: [], reason: "signed-out" as const };

    const [activeId, index] = await Promise.all([d.getActiveId(), d.getIndex()]);
    const candidates = index
      .filter((entry): entry is TreeIndexEntry => !isTreeStub(entry) && entry.id !== activeId)
      .sort((a, b) => sortKey(a) - sortKey(b));

    if (candidates.length === 0) return { stubbed: [], reason: "no-candidates" as const };

    const stubbed: string[] = [];
    let reason: SweepResult["reason"] | undefined;
    for (const entry of candidates) {
      if (stubbed.length >= MAX_STUBS_PER_SWEEP) {
        reason = "max-stubs";
        break;
      }
      const outcome = await safePush(d, entry.id);
      if (outcome !== "ok") {
        logger.info("skip candidate", { treeId: entry.id, outcome });
        continue;
      }
      try {
        await d.deleteBlob(entry.id);
        await d.stubEntry(entry.id);
      } catch (error) {
        logger.error("stub failed", {
          treeId: entry.id,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      stubbed.push(entry.id);

      let usage: number;
      try {
        usage = await d.getBytesInUse();
      } catch {
        continue;
      }
      if (usage < LOW_WATER) {
        reason = "below-low-water";
        break;
      }
    }

    if (stubbed.length > 0) {
      logger.info("sweep stubbed", { count: stubbed.length, ids: stubbed, reason });
      try {
        await d.notifyUpdate();
      } catch (error) {
        logger.warn("notify failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { stubbed, ...(reason ? { reason } : {}) };
  });
}

function sortKey(entry: TreeIndexEntry): number {
  return entry.lastOpenedAt ?? entry.savedAt;
}

async function safePush(d: RetentionDeps, treeId: string): Promise<string> {
  try {
    return await d.pushTree(treeId);
  } catch (error) {
    logger.warn("push threw", {
      treeId,
      error: error instanceof Error ? error.message : String(error),
    });
    return "error";
  }
}
