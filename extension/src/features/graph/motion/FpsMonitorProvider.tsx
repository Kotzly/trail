/**
 * Starts and stops the global FPS monitor (§0.4).
 *
 * The monitor is a singleton so multiple consumers subscribe to the
 * same measurement. Mount this provider once — at the sidepanel root —
 * and the loop runs for the lifetime of that mount.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { startFpsMonitor, stopFpsMonitor, useFpsTier, type FpsTier } from "./fps-tier.js";
import { markMotionDegraded } from "./telemetry.js";

function tierRank(tier: FpsTier): number {
  return tier === "high" ? 2 : tier === "mid" ? 1 : 0;
}

export function FpsMonitorProvider({ children }: { children: ReactNode }): ReactNode {
  useEffect(() => {
    startFpsMonitor();
    return () => {
      stopFpsMonitor();
    };
  }, []);

  // Emit telemetry only on *downgrade* transitions — upgrades are not
  // actionable signal (they just mean the machine caught up).
  const tier = useFpsTier();
  const prevTier = useRef<FpsTier>(tier);
  useEffect(() => {
    const previous = prevTier.current;
    prevTier.current = tier;
    if (tierRank(tier) < tierRank(previous)) {
      markMotionDegraded(previous, tier);
    }
  }, [tier]);

  return children;
}
