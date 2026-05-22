/**
 * Motion-layer telemetry (§0.5).
 *
 * Scope is deliberately tiny so we can start collecting behavioral
 * signal without blowing the PostHog free-tier event budget. Sampling
 * rates are hard-coded here, not remote-tuned, because surprises in
 * event volume cost real money.
 *
 * Privacy guards: we only ship anonymous counters. No URLs, titles,
 * or node content goes through here — those are already blocked at
 * the observability layer, but we double-check by never accepting
 * them as event properties in the first place.
 *
 * Consumers call `trackHover` on trigger; `markAmbientActive` flips a
 * sticky session bit; `flushSessionSummary` is called once on unload
 * / idle.
 */

import { captureEvent } from "@shared/lib/observability.js";

const HOVER_SAMPLE_RATE = 0.01;

let ambientOnDuringSession = false;

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
    duration_s: Math.round(sessionDurationMs / 1000),
  });
}

/**
 * Dispose any pending state (test teardown).
 */
export function __resetTelemetryForTest(): void {
  ambientOnDuringSession = false;
}
