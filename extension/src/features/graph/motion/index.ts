export { MotionPlatformProvider } from "./MotionPlatformProvider.js";
export { MotionFlagsProvider } from "./MotionFlagsProvider.js";
export { FpsMonitorProvider } from "./FpsMonitorProvider.js";

export { useMotionFlag, getMotionSnapshot } from "./store.js";
export { useFpsTier, getFpsTier, type FpsTier } from "./fps-tier.js";
export { useReducedMotion } from "./use-reduced-motion.js";
export { useRelayoutEnabled } from "./useRelayoutEnabled.js";
export { useCameraControls, type SmoothCenterOptions } from "./useCameraControls.js";

export {
  DEFAULT_MOTION_CONFIG,
  MOTION_FLAG_KEYS,
  type MotionConfig,
  type MotionFlagKey,
} from "./flags.js";

export {
  createLifecycleBatcher,
  type LifecycleCohort,
  type LifecycleEvent,
  type LifecycleEventKind,
  type BatcherOptions,
} from "./lifecycle-batcher.js";

export {
  trackHover,
  recordFrameDrop,
  markMotionDegraded,
  markAmbientActive,
  flushSessionSummary,
} from "./telemetry.js";
