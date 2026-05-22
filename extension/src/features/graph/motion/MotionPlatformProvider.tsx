/**
 * One entry point for the motion platform layer (§0 of the plan).
 *
 * Wraps the sidepanel root and spins up:
 *  - PostHog feature-flag refresh (snapshot-based, see `MotionFlagsProvider`)
 *
 * Consumers read signals through `useMotionFlag` and `useReducedMotion`
 * — those hooks work even if this provider isn't mounted, falling
 * back to safe defaults (see `DEFAULT_MOTION_CONFIG`). The provider's
 * job is purely to drive the refresh lifecycle.
 */

import type { ReactNode } from "react";
import { MotionFlagsProvider } from "./MotionFlagsProvider.js";

export function MotionPlatformProvider({ children }: { children: ReactNode }): ReactNode {
  return <MotionFlagsProvider>{children}</MotionFlagsProvider>;
}
