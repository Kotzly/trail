/**
 * Combined gate for graph re-layout animation.
 *
 * Re-layout transitions are expensive on large trees — they trigger a
 * transform on every `.react-flow__node`. We only enable them when:
 *  - the PostHog flag `lifecycle_relayout` is on,
 *  - the user has not requested reduced motion,
 *  - the current FPS tier is `high` (mid/low tiers drop the effect so
 *    the whole interaction stays responsive).
 *
 * The hook is cheap — each signal is a single subscription.
 */

import { useMotionFlag } from "./store.js";
import { useFpsTier } from "./fps-tier.js";
import { useReducedMotion } from "./use-reduced-motion.js";

export function useRelayoutEnabled(): boolean {
  const flag = useMotionFlag("lifecycle_relayout");
  const tier = useFpsTier();
  const reduced = useReducedMotion();
  return flag && tier === "high" && !reduced;
}
