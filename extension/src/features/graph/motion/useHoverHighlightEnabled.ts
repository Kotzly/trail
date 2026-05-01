/**
 * Gate for node hover highlight (glow on the hovered node).
 *
 * Combines the PostHog flag with prefers-reduced-motion. FPS tier is
 * intentionally not in this gate: the effect is a single CSS filter on
 * one element at a time, so even low-FPS machines can afford it. Keeping
 * it on at lower tiers preserves the "did I actually aim at this node?"
 * feedback that matters most when performance is already suffering.
 */

import { useMotionFlag } from "./store.js";
import { useReducedMotion } from "./use-reduced-motion.js";

export function useHoverHighlightEnabled(): boolean {
  const flag = useMotionFlag("hover_node_highlight");
  const reduced = useReducedMotion();
  return flag && !reduced;
}
