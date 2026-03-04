import { browser } from '@shared/platform/webext.js';

/**
 * Set of tab IDs where the spotlight script has already been injected.
 * Avoids double-injection; cleared when a tab is removed.
 */
const injectedTabs = new Set<number>();

function cleanupTab(tabId: number): void {
  injectedTabs.delete(tabId);
}

async function injectSpotlight(tabId: number): Promise<void> {
  try {
    console.log('[Spotlight] Injecting into tab', tabId);
    // WXT builds spotlight.content to content-scripts/spotlight.js
    await browser.scripting.executeScript({
      target: { tabId },
      files: ['/content-scripts/spotlight.js'],
    });
    injectedTabs.add(tabId);
    console.log('[Spotlight] Injection succeeded for tab', tabId);
  } catch (error) {
    console.warn('[Spotlight] Failed to inject into tab', tabId, error);
  }
}

async function toggleSpotlight(tabId: number): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, { type: 'TOGGLE_SPOTLIGHT' });
  } catch {
    // Content script not responding — re-inject
    injectedTabs.delete(tabId);
    await injectSpotlight(tabId);
  }
}

async function handleSpotlightCommand(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (injectedTabs.has(tab.id)) {
    await toggleSpotlight(tab.id);
  } else {
    await injectSpotlight(tab.id);
  }
}

export function initSpotlightCommand(): void {
  browser.commands.onCommand.addListener((command: string) => {
    console.log('[Spotlight] Command received:', command);
    if (command === 'toggle-spotlight') {
      void handleSpotlightCommand();
    }
  });

  // Clean up when tabs are removed
  browser.tabs.onRemoved.addListener((tabId: number) => {
    cleanupTab(tabId);
  });
}
