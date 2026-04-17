/**
 * Per-tab navigation pattern tracker.
 *
 * Detects and classifies navigation patterns so downstream cleanup
 * layers can decide what to do:
 *
 *   - glance: a node the user visited briefly (< threshold) and
 *     never returned to. Candidate for silent prune.
 *   - engaged: long dwell (≥ threshold), keep always.
 *   - burst-candidate: 3+ consecutive short-dwell navs with matching
 *     URL shape. Consumer (burst detector) promotes into a container.
 *
 * Key design: dwell is RETROSPECTIVE. We cannot know how long a user
 * stared at page N until one of:
 *   - A next nav commits on the same tab (dwell = t_next - t_enter)
 *   - The tab closes
 *   - The tab deactivates or window blurs
 * This means no timers — every classification fires on an edge event.
 * MV3 SW suspend doesn't affect us: state is persisted, and without
 * a next event there's nothing to classify yet.
 *
 * State is persisted to chrome.storage.session so SW suspend doesn't
 * lose in-flight dwell tracking.
 */

import { storage } from "wxt/utils/storage";
import { createLogger } from "@shared/lib/logger.js";
import type { NodeId, TabId, Url } from "@shared/types/ids.js";

const log = createLogger("nav-pattern");

/**
 * URL-shape signature. Strips leading `www.`, keeps host, keeps first
 * path segment with digits removed. Conservative — good enough for
 * detecting "arxiv.org/abs/*" or "reddit.com/r/*" style bursts.
 */
export function urlShape(url: Url | string): string {
  try {
    const u = new URL(url);
    const host = u.host.replace(/^www\./, "").toLowerCase();
    const segments = u.pathname.split("/").filter(Boolean);
    const firstSeg = segments[0] ?? "";
    const normalized = firstSeg.replace(/[0-9]+/g, "*");
    return `${host}/${normalized}`;
  } catch {
    return String(url).toLowerCase();
  }
}

export type TabNavState = {
  /** Last accepted nav on this tab (url, nodeId, timestamp). */
  lastUrl: string;
  lastShape: string;
  lastNodeId: string | null;
  lastEnteredAt: number;
  /** Is the tab currently focused in its window? Paused = not focused. */
  paused: boolean;
  /** When focus was lost (ms); used for blur-grace calculation. */
  pausedAt: number | null;
  /** Length of current same-shape streak (≥1 counts the last nav). */
  streak: number;
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

/**
 * Describes what the tracker learned about the PREVIOUS nav on this
 * tab when a new one arrived. Downstream cleanup consumes this to
 * decide pruning / promotion.
 */
export type NavClassification =
  | { kind: "none" }
  | { kind: "glance"; nodeId: NodeId; url: string; dwellMs: number }
  | { kind: "engaged"; nodeId: NodeId; url: string; dwellMs: number }
  | { kind: "burst-step"; nodeId: NodeId; url: string; streak: number; shape: string }
  | { kind: "burst-seal"; nodeId: NodeId; url: string; streak: number; shape: string };

export type ClassificationThresholds = {
  /** Dwell strictly under this → glance. */
  glanceMs: number;
  /** Dwell at or over this → engaged. */
  engagedMs: number;
  /** Min dwell to count as a burst step (filters redirect noise). */
  burstMinMs: number;
  /** Max dwell; crossing this seals the burst (user stopped to read). */
  burstMaxMs: number;
  /** Blur longer than this seals the burst; shorter just pauses dwell. */
  blurGraceMs: number;
};

export const DEFAULT_THRESHOLDS: ClassificationThresholds = {
  glanceMs: 5_000,
  engagedMs: 30_000,
  burstMinMs: 1_500,
  burstMaxMs: 8_000,
  blurGraceMs: 30_000,
};

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
  const shape = urlShape(url);

  let classification: NavClassification = { kind: "none" };

  if (prev && prev.lastNodeId) {
    // Compute dwell, discounting time spent paused/blurred (up to grace).
    let dwell = timestamp - prev.lastEnteredAt;
    if (prev.paused && prev.pausedAt) {
      // Active portion = pausedAt - lastEnteredAt (approximation — we
      // only subtract the final pause; earlier pauses aren't tracked).
      dwell = prev.pausedAt - prev.lastEnteredAt;
    }
    const prevNodeId = prev.lastNodeId as NodeId;
    const prevUrl = prev.lastUrl;
    const sameShape = prev.lastShape === shape;
    const dwellInBurstRange = dwell >= thresholds.burstMinMs && dwell <= thresholds.burstMaxMs;

    if (sameShape && dwellInBurstRange) {
      const streak = prev.streak + 1;
      classification = {
        kind: streak >= 3 ? "burst-step" : "burst-step",
        nodeId: prevNodeId,
        url: prevUrl,
        streak,
        shape,
      };
      // Promote streak on the new record.
      state.set(tabId, {
        lastUrl: url as string,
        lastShape: shape,
        lastNodeId: (nodeId as string | null) ?? null,
        lastEnteredAt: timestamp,
        paused: false,
        pausedAt: null,
        streak,
      });
      persist();
      return classification;
    }

    // Shape mismatch OR dwell out of burst range → seal any current
    // burst, classify prev as glance/engaged, start fresh.
    if (prev.streak >= 3) {
      classification = {
        kind: "burst-seal",
        nodeId: prevNodeId,
        url: prevUrl,
        streak: prev.streak,
        shape: prev.lastShape,
      };
    } else if (dwell < thresholds.glanceMs) {
      classification = {
        kind: "glance",
        nodeId: prevNodeId,
        url: prevUrl,
        dwellMs: dwell,
      };
    } else if (dwell >= thresholds.engagedMs) {
      classification = {
        kind: "engaged",
        nodeId: prevNodeId,
        url: prevUrl,
        dwellMs: dwell,
      };
    }
    // Middle-band (5–30s): no tag — a normal visit, kept.
  }

  // Record this nav as the new head of the trail.
  state.set(tabId, {
    lastUrl: url as string,
    lastShape: shape,
    lastNodeId: (nodeId as string | null) ?? null,
    lastEnteredAt: timestamp,
    paused: false,
    pausedAt: null,
    streak: 1,
  });
  persist();
  return classification;
}

/**
 * Called when the tab closes or loses node mapping. Returns the
 * classification for the final nav (likely glance or engaged) so
 * the caller can prune / mark accordingly.
 */
export function onTabFinished(
  tabId: TabId,
  now: number,
  thresholds: ClassificationThresholds = DEFAULT_THRESHOLDS,
): NavClassification {
  const prev = state.get(tabId);
  state.delete(tabId);
  persist();
  if (!prev || !prev.lastNodeId) return { kind: "none" };
  let dwell = now - prev.lastEnteredAt;
  if (prev.paused && prev.pausedAt) dwell = prev.pausedAt - prev.lastEnteredAt;
  const nodeId = prev.lastNodeId as NodeId;

  if (prev.streak >= 3) {
    return {
      kind: "burst-seal",
      nodeId,
      url: prev.lastUrl,
      streak: prev.streak,
      shape: prev.lastShape,
    };
  }
  if (dwell < thresholds.glanceMs) {
    return { kind: "glance", nodeId, url: prev.lastUrl, dwellMs: dwell };
  }
  if (dwell >= thresholds.engagedMs) {
    return { kind: "engaged", nodeId, url: prev.lastUrl, dwellMs: dwell };
  }
  return { kind: "none" };
}

/** Tab focus signal: pause the dwell clock. */
export function onTabBlur(tabId: TabId, now: number): void {
  const prev = state.get(tabId);
  if (!prev || prev.paused) return;
  state.set(tabId, { ...prev, paused: true, pausedAt: now });
  persist();
}

/**
 * Tab focus regained. Advances lastEnteredAt so any paused time is
 * forgiven up to blurGraceMs; past that, we seal by setting streak=1
 * and zeroing the dwell window.
 */
export function onTabFocus(
  tabId: TabId,
  now: number,
  thresholds: ClassificationThresholds = DEFAULT_THRESHOLDS,
): NavClassification {
  const prev = state.get(tabId);
  if (!prev || !prev.paused || prev.pausedAt === null) return { kind: "none" };
  const blurDuration = now - prev.pausedAt;
  if (blurDuration >= thresholds.blurGraceMs && prev.streak >= 3) {
    // Seal the active burst — user left for too long.
    const cls: NavClassification = {
      kind: "burst-seal",
      nodeId: prev.lastNodeId as NodeId,
      url: prev.lastUrl,
      streak: prev.streak,
      shape: prev.lastShape,
    };
    state.set(tabId, {
      ...prev,
      paused: false,
      pausedAt: null,
      // Reset streak; next nav starts a fresh single-hop.
      streak: 1,
      // Roll lastEnteredAt forward so dwell resets.
      lastEnteredAt: now,
    });
    persist();
    return cls;
  }
  // Short blur: just unpause, roll start time forward by the blur gap
  // so dwell only counts active time.
  state.set(tabId, {
    ...prev,
    paused: false,
    pausedAt: null,
    lastEnteredAt: prev.lastEnteredAt + blurDuration,
  });
  persist();
  return { kind: "none" };
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
