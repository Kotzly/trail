/**
 * Track the user's `prefers-reduced-motion` setting reactively.
 *
 * Reduced motion doesn't mean "zero animation" — we still want opacity
 * and color transitions that aid comprehension. Callers use this hook
 * to gate the *motion-based* animations (transforms, movement,
 * position changes) while leaving communicative fades in place.
 */

import { useSyncExternalStore } from "react";

const MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(listener: () => void): () => void {
  const mql = window.matchMedia(MEDIA_QUERY);
  mql.addEventListener("change", listener);
  return () => {
    mql.removeEventListener("change", listener);
  };
}

function getSnapshot(): boolean {
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
