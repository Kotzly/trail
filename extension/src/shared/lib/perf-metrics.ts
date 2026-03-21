/**
 * Lightweight performance metric recorder for contexts where
 * graph-profiler.ts is unavailable (e.g. service worker — no `window`).
 *
 * Records named metrics and logs budget breaches via structured logger.
 */

import { createLogger } from "./logger.js";

const log = createLogger("perf-budget");

const BUDGET_THRESHOLDS: Record<string, number> = {
  spotlightQueryMs: 100,
};

const latestValues = new Map<string, number>();

export function recordMetric(name: string, value: number): void {
  latestValues.set(name, value);
  const threshold = BUDGET_THRESHOLDS[name];
  if (threshold != null && value > threshold) {
    log.warn("budget breach", { metric: name, value: Math.round(value), threshold });
  }
}

export function getMetric(name: string): number | null {
  return latestValues.get(name) ?? null;
}
