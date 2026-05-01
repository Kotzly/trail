/**
 * Runs the refresh lifecycle for motion flags (§0.1 of the plan).
 *
 * Snapshot-based refresh strategy:
 *  1. Mount with DEFAULT_MOTION_CONFIG → first render never blocks on
 *     the network.
 *  2. After paint, fetch the current PostHog flag set and commit if it
 *     differs from defaults.
 *  3. Every REFRESH_INTERVAL_MS quietly ask PostHog to reload. If the
 *     snapshot differs, commit — this is the remote kill-switch path.
 *     Unchanged snapshots are a no-op (no re-renders).
 *  4. Committed changes apply to the *next* animation trigger. Already
 *     running animations finish on their current flag value (the flag
 *     is only read at trigger time).
 *
 * Dev bypass: `window.__trailMotionReload()` forces an immediate
 * refresh so we can iterate locally without waiting a minute.
 */

import { useEffect, type ReactNode } from "react";
import { readFeatureFlagSnapshot, reloadFeatureFlags } from "@shared/lib/observability.js";
import { MOTION_FLAG_KEYS, mergeMotionSnapshot } from "./flags.js";
import { setMotionSnapshot } from "./store.js";

const PROD_REFRESH_MS = 60_000;
const DEV_REFRESH_MS = 5_000;

declare global {
  interface Window {
    __trailMotionReload?: () => Promise<void>;
  }
}

async function pullSnapshot(): Promise<void> {
  const remote = readFeatureFlagSnapshot(MOTION_FLAG_KEYS);
  setMotionSnapshot(mergeMotionSnapshot(remote));
}

async function pullSnapshotAfterReload(): Promise<void> {
  await reloadFeatureFlags();
  await pullSnapshot();
}

export function MotionFlagsProvider({ children }: { children: ReactNode }): ReactNode {
  useEffect(() => {
    let cancelled = false;

    // Initial snapshot: read whatever PostHog already has cached, then
    // trigger a reload so the first authoritative snapshot lands within
    // a few seconds instead of waiting a full refresh window.
    void pullSnapshot();
    void pullSnapshotAfterReload().catch(() => {
      // observability is a no-op if unconfigured; swallow network errors
    });

    const intervalMs = import.meta.env.DEV ? DEV_REFRESH_MS : PROD_REFRESH_MS;
    const timer = window.setInterval(() => {
      if (cancelled) return;
      void pullSnapshotAfterReload().catch(() => {});
    }, intervalMs);

    if (import.meta.env.DEV) {
      window.__trailMotionReload = async () => {
        await pullSnapshotAfterReload();
      };
    }

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (import.meta.env.DEV) {
        delete window.__trailMotionReload;
      }
    };
  }, []);

  return children;
}
