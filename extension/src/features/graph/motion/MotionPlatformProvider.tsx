/**
 * One entry point for the motion platform layer (§0 of the plan).
 *
 * Wraps the sidepanel root and spins up:
 *  - PostHog feature-flag refresh (snapshot-based, see `MotionFlagsProvider`)
 *  - Runtime FPS monitor with hysteresis (see `FpsMonitorProvider`)
 *
 * Consumers read signals through `useMotionFlag`, `useFpsTier`, and
 * `useReducedMotion` — those hooks work even if this provider isn't
 * mounted, falling back to safe defaults (see `DEFAULT_MOTION_CONFIG`
 * and `getFpsTier` returning `"high"`). The provider's job is purely
 * to drive the refresh lifecycle.
 */

import type { ReactNode } from "react";
import { MotionFlagsProvider } from "./MotionFlagsProvider.js";
import { FpsMonitorProvider } from "./FpsMonitorProvider.js";

export function MotionPlatformProvider({ children }: { children: ReactNode }): ReactNode {
  return (
    <MotionFlagsProvider>
      <FpsMonitorProvider>{children}</FpsMonitorProvider>
    </MotionFlagsProvider>
  );
}
