// ---------------------------------------------------------------------------
// Offscreen Graph Manager
//
// Creates and maintains the offscreen document that pre-computes graph
// layout positions. Chrome allows only one offscreen document at a time
// per extension, so we check before creating.
// ---------------------------------------------------------------------------

import { notifyUi } from "../messaging/ui-notifications.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("offscreen-graph");

const OFFSCREEN_URL = "offscreen-graph.html";
let offscreenFailNotified = false;

const REASON = chrome.offscreen.Reason.WORKERS;

async function hasOffscreenDocument(): Promise<boolean> {
  // chrome.runtime.getContexts is available in Chrome 116+
  if (!chrome.runtime.getContexts) return false;

  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });

  return contexts.length > 0;
}

async function ensureOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) return;

  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [REASON],
      justification: "Pre-compute graph layout positions for instant display",
    });
    log.debug("Offscreen document created");
  } catch (err) {
    // May fail if another offscreen document exists or API unavailable
    log.warn("Failed to create offscreen document", { error: err instanceof Error ? err.message : String(err) });
    if (!offscreenFailNotified) {
      offscreenFailNotified = true;
      notifyUi({
        message: "Using basic layout mode",
        icon: "AlertTriangle",
        durationMs: 5000,
      });
    }
  }
}

export function initOffscreenGraphManager(): void {
  // Create offscreen document on service worker startup
  void ensureOffscreenDocument();

  // Re-create if service worker wakes from idle
  chrome.runtime.onStartup?.addListener(() => {
    void ensureOffscreenDocument();
  });
}
