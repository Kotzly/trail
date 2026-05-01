/**
 * Runtime FPS monitor with hysteresis (§0.4).
 *
 * Measures rolling-window FPS via requestAnimationFrame deltas and
 * exposes a tier signal (`high | mid | low`). Callers use the tier to
 * degrade expensive animations when the machine can't keep up.
 *
 * Hysteresis: once we drop to a lower tier we *stay* there for
 * STICKY_MS (10s), even if FPS recovers. Promotion back up requires
 * FPS stable at `threshold + HYSTERESIS_MARGIN` for STICKY_MS. This
 * prevents features from flickering on/off around a threshold.
 *
 * Paused while `document.hidden` — background tabs don't need FPS
 * measurement and RAF fires at 1Hz anyway, which would falsely report
 * "low" tier.
 */

import { useSyncExternalStore } from "react";

export type FpsTier = "high" | "mid" | "low";

const HIGH_THRESHOLD = 55;
const MID_THRESHOLD = 40;
const HYSTERESIS_MARGIN = 5;
const STICKY_MS = 10_000;
const WINDOW_SIZE = 60;

let currentTier: FpsTier = "high";
let lastDowngradeAt = 0;
let lastStableAboveAt = 0;
let running = false;
let rafId: number | null = null;
let visibilityBound = false;

// Fixed-capacity ring buffer for frame deltas: O(1) push, no Array.shift
// allocation churn per frame. Capacity is WINDOW_SIZE.
const frameDeltas: Float64Array = new Float64Array(WINDOW_SIZE);
let frameDeltaCount = 0;
let frameDeltaHead = 0;
let frameDeltaSum = 0;
let prevFrameAt = 0;

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const l of listeners) l();
}

function pushFrameDelta(delta: number): void {
  if (frameDeltaCount < WINDOW_SIZE) {
    frameDeltas[frameDeltaHead] = delta;
    frameDeltaSum += delta;
    frameDeltaCount += 1;
  } else {
    frameDeltaSum += delta - (frameDeltas[frameDeltaHead] ?? 0);
    frameDeltas[frameDeltaHead] = delta;
  }
  frameDeltaHead = (frameDeltaHead + 1) % WINDOW_SIZE;
}

function currentFps(): number {
  if (frameDeltaCount === 0) return 60;
  const avgDelta = frameDeltaSum / frameDeltaCount;
  if (avgDelta <= 0) return 60;
  return 1000 / avgDelta;
}

function computeTargetTier(fps: number): FpsTier {
  if (fps >= HIGH_THRESHOLD) return "high";
  if (fps >= MID_THRESHOLD) return "mid";
  return "low";
}

/**
 * Hysteresis: apply the target tier respecting sticky windows.
 * Downgrades are always immediate; upgrades require the FPS to be
 * stable above the next tier's threshold + margin for STICKY_MS.
 */
function applyHysteresis(target: FpsTier, now: number, fps: number): void {
  if (tierRank(target) > tierRank(currentTier)) {
    // Potential upgrade
    const promotionThreshold =
      currentTier === "low"
        ? MID_THRESHOLD + HYSTERESIS_MARGIN
        : HIGH_THRESHOLD + HYSTERESIS_MARGIN;
    if (fps >= promotionThreshold) {
      if (lastStableAboveAt === 0) lastStableAboveAt = now;
      if (now - lastStableAboveAt >= STICKY_MS) {
        setTier(target);
        lastStableAboveAt = 0;
      }
    } else {
      lastStableAboveAt = 0;
    }
    return;
  }

  if (tierRank(target) < tierRank(currentTier)) {
    // Downgrade — immediate, then stick for STICKY_MS before any upgrade
    setTier(target);
    lastDowngradeAt = now;
    lastStableAboveAt = 0;
    return;
  }

  // Same tier — just reset the upgrade tracker so it doesn't linger
  if (now - lastDowngradeAt < STICKY_MS) {
    lastStableAboveAt = 0;
  }
}

function tierRank(tier: FpsTier): number {
  return tier === "high" ? 2 : tier === "mid" ? 1 : 0;
}

function setTier(next: FpsTier): void {
  if (next === currentTier) return;
  currentTier = next;
  emit();
}

function tick(timestamp: number): void {
  if (!running) return;

  if (prevFrameAt !== 0) {
    pushFrameDelta(timestamp - prevFrameAt);
    if (frameDeltaCount >= 20) {
      const fps = currentFps();
      const target = computeTargetTier(fps);
      applyHysteresis(target, timestamp, fps);
    }
  }
  prevFrameAt = timestamp;
  rafId = window.requestAnimationFrame(tick);
}

function resetSamples(): void {
  frameDeltaCount = 0;
  frameDeltaHead = 0;
  frameDeltaSum = 0;
  prevFrameAt = 0;
}

function onVisibilityChange(): void {
  if (document.hidden) {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    resetSamples();
  } else if (running && rafId === null) {
    resetSamples();
    rafId = window.requestAnimationFrame(tick);
  }
}

/** Start the FPS monitor loop. Idempotent. */
export function startFpsMonitor(): void {
  if (running) return;
  running = true;
  resetSamples();
  if (!visibilityBound) {
    document.addEventListener("visibilitychange", onVisibilityChange);
    visibilityBound = true;
  }
  if (!document.hidden) {
    rafId = window.requestAnimationFrame(tick);
  }
}

/** Stop the FPS monitor loop. Idempotent. */
export function stopFpsMonitor(): void {
  if (!running) return;
  running = false;
  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (visibilityBound) {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    visibilityBound = false;
  }
  resetSamples();
}

/** Imperative read — avoid in render; use `useFpsTier` instead. */
export function getFpsTier(): FpsTier {
  return currentTier;
}

export function useFpsTier(): FpsTier {
  return useSyncExternalStore(
    subscribe,
    () => currentTier,
    () => "high" as FpsTier,
  );
}
