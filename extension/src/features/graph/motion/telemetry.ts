/**
 * Motion-layer telemetry (§0.5).
 *
 * Scope is deliberately tiny — four event shapes — so we can start
 * collecting behavioral signal without blowing the PostHog free-tier
 * event budget. Sampling rates are hard-coded here, not remote-tuned,
 * because surprises in event volume cost real money.
 *
 * Privacy guards: we only ship anonymous counters and perf metrics.
 * No URLs, titles, or node content goes through here — those are
 * already blocked at the observability layer, but we double-check by
 * never accepting them as event properties in the first place.
 *
 * Consumers call `trackHover`, `trackFrameDrop`, `markMotionDegraded`
 * on trigger; `flushSessionSummary` is called once on unload / idle.
 */

import { captureEvent } from "@shared/lib/observability.js";
import type { FpsTier } from "./fps-tier.js";

const HOVER_SAMPLE_RATE = 0.01;
const FRAME_DROP_REPORT_INTERVAL_MS = 60_000;

type FrameDropAgg = {
  tier: FpsTier;
  drops: number;
  avgFps: number;
  sampleCount: number;
};

let frameDropBuffer: FrameDropAgg | null = null;
let frameDropFlushTimer: number | null = null;

let ambientOnDuringSession = false;
let degradedDuringSession = false;

/**
 * Sampled hover event. Most hovers are dropped to stay under the
 * free-tier limit. Property is intentionally bare — no node id, no
 * URL, no cluster metadata.
 */
export function trackHover(target: "node" | "edge" | "cluster"): void {
  if (Math.random() > HOVER_SAMPLE_RATE) return;
  captureEvent("graph.hover", { target });
}

/**
 * Called from the FPS monitor when a frame-drop event is detected.
 * We don't send one event per drop — we aggregate into a rolling
 * buffer and flush once per FRAME_DROP_REPORT_INTERVAL_MS.
 */
export function recordFrameDrop(tier: FpsTier, instantaneousFps: number): void {
  if (frameDropBuffer === null) {
    frameDropBuffer = {
      tier,
      drops: 1,
      avgFps: instantaneousFps,
      sampleCount: 1,
    };
  } else {
    frameDropBuffer.drops += 1;
    frameDropBuffer.avgFps =
      (frameDropBuffer.avgFps * frameDropBuffer.sampleCount + instantaneousFps) /
      (frameDropBuffer.sampleCount + 1);
    frameDropBuffer.sampleCount += 1;
    // Always report the worst tier seen in the window
    if (tierRank(tier) < tierRank(frameDropBuffer.tier)) {
      frameDropBuffer.tier = tier;
    }
  }

  if (frameDropFlushTimer === null) {
    frameDropFlushTimer = window.setTimeout(flushFrameDrops, FRAME_DROP_REPORT_INTERVAL_MS);
  }
}

function tierRank(tier: FpsTier): number {
  return tier === "high" ? 2 : tier === "mid" ? 1 : 0;
}

function flushFrameDrops(): void {
  frameDropFlushTimer = null;
  if (!frameDropBuffer) return;
  captureEvent("graph.frame_drop", {
    tier: frameDropBuffer.tier,
    drops_count: frameDropBuffer.drops,
    avg_fps: Math.round(frameDropBuffer.avgFps),
  });
  frameDropBuffer = null;
}

/**
 * Fire when motion degrades into a lower FPS tier. 100% captured
 * because the signal is binary (transition moments are rare) and
 * highly actionable — these are the events that tell us which user
 * populations hit performance ceilings.
 */
export function markMotionDegraded(from: FpsTier, to: FpsTier): void {
  degradedDuringSession = true;
  captureEvent("graph.motion_degraded", { from, to });
}

/**
 * Record that the ambient layer was active at some point in the
 * session. Sampled at most once per session (boolean sticky).
 */
export function markAmbientActive(): void {
  ambientOnDuringSession = true;
}

/**
 * Called from the sidepanel `visibilitychange` → hidden, or on an
 * idle timer. Sends a single summary event per session.
 */
export function flushSessionSummary(sessionDurationMs: number): void {
  captureEvent("graph.ambient_session", {
    ambient_on: ambientOnDuringSession,
    degraded: degradedDuringSession,
    duration_s: Math.round(sessionDurationMs / 1000),
  });
}

/**
 * Dispose any pending timers (test teardown).
 */
export function __resetTelemetryForTest(): void {
  if (frameDropFlushTimer !== null) {
    window.clearTimeout(frameDropFlushTimer);
    frameDropFlushTimer = null;
  }
  frameDropBuffer = null;
  ambientOnDuringSession = false;
  degradedDuringSession = false;
}
