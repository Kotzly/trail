/**
 * Combined gate for graph re-layout animation.
 *
 * Re-layout transitions animate `.react-flow__node` transforms when
 * the tree shape changes (collapse, expand, reparent, deletion). We
 * enable them when:
 *  - the PostHog flag `lifecycle_relayout` is on,
 *  - the user has not requested reduced motion,
 *  - the current FPS tier is `high` or `mid`. Only `low` (struggling
 *    device) bails out — the relayout is a one-shot transform tween,
 *    not a continuous loop, so it doesn't need elite headroom.
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
  return flag && tier !== "low" && !reduced;
}
