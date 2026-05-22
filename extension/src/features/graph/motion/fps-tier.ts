/**
 * FPS-tier signal — stubbed to always report `high`.
 *
 * Background: this module used to run a continuous `requestAnimationFrame`
 * loop that measured rolling-window FPS and emitted a tri-state tier
 * (`high | mid | low`) so a small number of animations could degrade on
 * struggling devices. A CPU profile during pan/zoom on a 1808-node tree
 * showed the monitor's `tick` running at ~1.7% main thread (163ms
 * inclusive over a 9.5s recording) — pure idle overhead, since the
 * extension targets modern Chrome/Brave on desktop where sub-40 FPS
 * machines effectively don't exist in the user base.
 *
 * The signal is preserved as a `"high"` constant so the three consumers
 * (`useRelayoutEnabled`, `useCameraControls`, `useNodeLifecycle`) keep
 * compiling and behave as if every machine can afford the full
 * animation set. If we ever ship to a platform where adaptive
 * degradation is load-bearing again, restore the measurement loop —
 * the API on this module is unchanged.
 *
 * `startFpsMonitor` / `stopFpsMonitor` remain as no-ops so callers
 * (e.g. `FpsMonitorProvider`) don't need to know the implementation
 * changed.
 */

export type FpsTier = "high" | "mid" | "low";

/** No-op: the monitor loop was removed; tier is a constant `"high"`. */
export function startFpsMonitor(): void {
  /* no-op */
}

/** No-op: there is no loop to stop. */
export function stopFpsMonitor(): void {
  /* no-op */
}

/** Imperative read — always `"high"`. */
export function getFpsTier(): FpsTier {
  return "high";
}

/** Hook variant. Subscription is unnecessary because the value never changes. */
export function useFpsTier(): FpsTier {
  return "high";
}
