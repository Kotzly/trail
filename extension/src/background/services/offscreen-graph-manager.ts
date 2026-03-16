// ---------------------------------------------------------------------------
// Offscreen Graph Manager
//
// Creates and maintains the offscreen document that pre-computes graph
// layout positions. Chrome allows only one offscreen document at a time
// per extension, so we check before creating.
// ---------------------------------------------------------------------------

const OFFSCREEN_URL = 'offscreen-graph.html';

type OffscreenReason = chrome.offscreen.Reason;
const REASON: OffscreenReason = 'WORKERS' as OffscreenReason;

async function hasOffscreenDocument(): Promise<boolean> {
  // chrome.runtime.getContexts is available in Chrome 116+
  const getContexts = (chrome.runtime as unknown as {
    getContexts?: (filter: {
      contextTypes: string[];
      documentUrls: string[];
    }) => Promise<Array<{ documentUrl: string }>>;
  }).getContexts;

  if (!getContexts) return false;

  const contexts = await getContexts.call(chrome.runtime, {
    contextTypes: ['OFFSCREEN_DOCUMENT'],
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
      justification: 'Pre-compute graph layout positions for instant display',
    });
    console.debug('[offscreen-graph-manager] offscreen document created');
  } catch (err) {
    // May fail if another offscreen document exists or API unavailable
    console.warn('[offscreen-graph-manager] failed to create offscreen document:', err);
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
