/**
 * Per-tab navigation pattern tracker.
 *
 * Classifies the PREVIOUS nav on a tab when a new one arrives (or the
 * tab closes / loses focus) so Layer 3a (glance prune) can decide
 * whether the node is worth keeping:
 *
 *   - glance: user dwelled under `glanceMs` → candidate for prune
 *   - engaged: user dwelled at/over `engagedMs` → definitely keep
 *   - none: middle-band visit, keep silently
 *
 * Design: dwell is RETROSPECTIVE — we only know how long a user stared
 * at a page once one of {next nav, tab close, tab blur} fires. No
 * timers; MV3 suspend is safe because state is persisted to
 * chrome.storage.session.
 */

import { storage } from "wxt/utils/storage";
import { createLogger } from "@shared/lib/logger.js";
import type { NodeId, TabId, Url } from "@shared/types/ids.js";

const log = createLogger("nav-pattern");

export type TabNavState = {
  lastUrl: string;
  lastNodeId: string | null;
  lastEnteredAt: number;
  /** True while the tab is blurred; used to discount paused time. */
  paused: boolean;
  pausedAt: number | null;
};

const tabNavStateItem = storage.defineItem<Record<string, TabNavState>>(
  "session:trail_nav_pattern_by_tab",
  { fallback: {} },
);

const state = new Map<TabId, TabNavState>();
let hydrated = false;

export async function hydrateNavPatterns(): Promise<void> {
  if (hydrated) return;
  try {
    const raw = await tabNavStateItem.getValue();
    for (const [tabKey, value] of Object.entries(raw ?? {})) {
      const tabId = Number(tabKey);
      if (!Number.isFinite(tabId)) continue;
      state.set(tabId as TabId, value);
    }
  } catch (error) {
    log.warn("hydrate failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  hydrated = true;
}

function persist(): void {
  const snapshot: Record<string, TabNavState> = {};
  for (const [tabId, value] of state.entries()) {
    snapshot[String(tabId)] = value;
  }
  void tabNavStateItem.setValue(snapshot).catch((error) => {
    log.warn("persist failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

export type NavClassification =
  | { kind: "none" }
  | { kind: "glance"; nodeId: NodeId; url: string; dwellMs: number }
  | { kind: "engaged"; nodeId: NodeId; url: string; dwellMs: number };

export type ClassificationThresholds = {
  /** Dwell strictly under this → glance. */
  glanceMs: number;
  /** Dwell at or over this → engaged. */
  engagedMs: number;
  /** Blur longer than this forces dwell to reset on refocus. */
  blurGraceMs: number;
};

export const DEFAULT_THRESHOLDS: ClassificationThresholds = {
  glanceMs: 5_000,
  engagedMs: 30_000,
  blurGraceMs: 30_000,
};

function dwellFor(prev: TabNavState, now: number): number {
  if (prev.paused && prev.pausedAt !== null) {
    return prev.pausedAt - prev.lastEnteredAt;
  }
  return now - prev.lastEnteredAt;
}

function classifyDwell(
  prev: TabNavState,
  dwell: number,
  thresholds: ClassificationThresholds,
): NavClassification {
  if (!prev.lastNodeId) return { kind: "none" };
  const nodeId = prev.lastNodeId as NodeId;
  if (dwell < thresholds.glanceMs) {
    return { kind: "glance", nodeId, url: prev.lastUrl, dwellMs: dwell };
  }
  if (dwell >= thresholds.engagedMs) {
    return { kind: "engaged", nodeId, url: prev.lastUrl, dwellMs: dwell };
  }
  return { kind: "none" };
}

/**
 * Register a navigation on a tab. Returns the classification for the
 * PREVIOUS nav on this tab (if any), now that we know how long the
 * user dwelled on it.
 */
export function onNavigation(
  tabId: TabId,
  url: Url,
  nodeId: NodeId | null,
  timestamp: number,
  thresholds: ClassificationThresholds = DEFAULT_THRESHOLDS,
): NavClassification {
  const prev = state.get(tabId);
  const classification: NavClassification = prev
    ? classifyDwell(prev, dwellFor(prev, timestamp), thresholds)
    : { kind: "none" };

  state.set(tabId, {
    lastUrl: url as string,
    lastNodeId: (nodeId as string | null) ?? null,
    lastEnteredAt: timestamp,
    paused: false,
    pausedAt: null,
  });
  persist();
  return classification;
}

/**
 * Called when the tab closes or loses node mapping. Returns the
 * classification for the final nav so the caller can prune / mark.
 */
export function onTabFinished(
  tabId: TabId,
  now: number,
  thresholds: ClassificationThresholds = DEFAULT_THRESHOLDS,
): NavClassification {
  const prev = state.get(tabId);
  state.delete(tabId);
  persist();
  if (!prev) return { kind: "none" };
  return classifyDwell(prev, dwellFor(prev, now), thresholds);
}

/** Tab focus signal: pause the dwell clock. */
export function onTabBlur(tabId: TabId, now: number): void {
  const prev = state.get(tabId);
  if (!prev || prev.paused) return;
  state.set(tabId, { ...prev, paused: true, pausedAt: now });
  persist();
}

/**
 * Tab focus regained. Short blurs just unpause; blurs past
 * `blurGraceMs` reset the dwell window so the pre-blur time isn't
 * counted.
 */
export function onTabFocus(
  tabId: TabId,
  now: number,
  thresholds: ClassificationThresholds = DEFAULT_THRESHOLDS,
): void {
  const prev = state.get(tabId);
  if (!prev || !prev.paused || prev.pausedAt === null) return;
  const blurDuration = now - prev.pausedAt;
  if (blurDuration >= thresholds.blurGraceMs) {
    state.set(tabId, { ...prev, paused: false, pausedAt: null, lastEnteredAt: now });
  } else {
    state.set(tabId, {
      ...prev,
      paused: false,
      pausedAt: null,
      lastEnteredAt: prev.lastEnteredAt + blurDuration,
    });
  }
  persist();
}

/** Remove state for a tab (on tab close). */
export function onTabRemoved(tabId: TabId): void {
  if (state.has(tabId)) {
    state.delete(tabId);
    persist();
  }
}

/** Diagnostic helper. */
export function getTabState(tabId: TabId): TabNavState | undefined {
  return state.get(tabId);
}
