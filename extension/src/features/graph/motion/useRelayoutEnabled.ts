/**
 * Combined gate for graph re-layout animation.
 *
 * Re-layout transitions animate `.react-flow__node` transforms when
 * the tree shape changes (collapse, expand, reparent, deletion). We
 * enable them when:
 *  - the PostHog flag `lifecycle_relayout` is on,
 *  - the user has not requested reduced motion.
 *
 * The hook is cheap — each signal is a single subscription.
 */

import { useMotionFlag } from "./store.js";
import { useReducedMotion } from "./use-reduced-motion.js";

export function useRelayoutEnabled(): boolean {
  const flag = useMotionFlag("lifecycle_relayout");
  const reduced = useReducedMotion();
  return flag && !reduced;
}
