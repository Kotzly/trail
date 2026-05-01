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

// Lazy module-level MediaQueryList — one per process instead of one per
// render. `matchMedia` is not free; cached callers save a DOM call on
// every `useSyncExternalStore` snapshot read (can fire multiple times
// per render per subscriber).
let mql: MediaQueryList | null = null;
function getMql(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  if (!mql) mql = window.matchMedia(MEDIA_QUERY);
  return mql;
}

function subscribe(listener: () => void): () => void {
  const m = getMql();
  if (!m) return () => {};
  m.addEventListener("change", listener);
  return () => {
    m.removeEventListener("change", listener);
  };
}

function getSnapshot(): boolean {
  return getMql()?.matches ?? false;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
