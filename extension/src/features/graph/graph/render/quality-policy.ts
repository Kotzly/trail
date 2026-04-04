export type AdaptiveDetailMode = "full" | "low" | "dot";
export type AdaptiveConnectionQuality = "full" | "simplified" | "thin";

export type QualityPolicySample = {
  frameMs: number;
  updateVisibleMs: number;
  connectionsMs: number;
  renderMs: number;
  visibleNodes: number;
  visibleConnections: number;
};

export type QualityPolicyState = {
  level: AdaptiveDetailMode;
  ewmaMs: number;
  historyMs: number[];
  lastTransitionAt: number;
};

export type QualityPolicyResult = {
  detailMode: AdaptiveDetailMode;
  connectionQuality: AdaptiveConnectionQuality;
};

const EWMA_ALPHA = 0.2;
const HISTORY_LIMIT = 45;
const HYSTERESIS_MS = 1200;

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx] ?? 0;
}

function toResult(level: AdaptiveDetailMode): QualityPolicyResult {
  if (level === "dot") {
    return { detailMode: "dot", connectionQuality: "thin" };
  }
  if (level === "low") {
    return { detailMode: "low", connectionQuality: "simplified" };
  }
  return { detailMode: "full", connectionQuality: "full" };
}

export function createQualityPolicyState(now = Date.now()): QualityPolicyState {
  return {
    level: "full",
    ewmaMs: 16,
    historyMs: [],
    lastTransitionAt: now,
  };
}

export function qualityPolicyFromState(state: QualityPolicyState): QualityPolicyResult {
  return toResult(state.level);
}

export function updateQualityPolicy(
  prev: QualityPolicyState,
  sample: QualityPolicySample,
  now = Date.now(),
): { state: QualityPolicyState; result: QualityPolicyResult; scoreMs: number } {
  const frameMs = Number.isFinite(sample.frameMs) ? sample.frameMs : 0;
  const ewmaMs = prev.ewmaMs + (frameMs - prev.ewmaMs) * EWMA_ALPHA;
  const historyMs = [...prev.historyMs, frameMs].slice(-HISTORY_LIMIT);
  const p95 = percentile(historyMs, 0.95);
  const scoreMs = Math.max(ewmaMs, p95);

  let level = prev.level;
  const canTransition = now - prev.lastTransitionAt >= HYSTERESIS_MS;

  if (level === "full") {
    if (scoreMs >= 22 && canTransition) {
      level = "low";
    }
  } else if (level === "low") {
    if (scoreMs <= 14 && canTransition) {
      level = "full";
    }
  } else if (level === "dot") {
    // Recover from dot immediately — dot is disabled
    level = "low";
  }

  const transitioned = level !== prev.level;
  const nextState: QualityPolicyState = {
    level,
    ewmaMs,
    historyMs,
    lastTransitionAt: transitioned ? now : prev.lastTransitionAt,
  };

  return {
    state: nextState,
    result: toResult(nextState.level),
    scoreMs,
  };
}
