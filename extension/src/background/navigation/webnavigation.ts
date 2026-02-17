
import { handleNavigation } from './navigation-handler.js';

/**
 * Initialize webNavigation event listeners.
 */
export function initWebNavigation(): void {
  const listener = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
    handleNavigation(details).catch(() => {
      // Navigation handler error — silently ignored.
    });
  };

  chrome.webNavigation.onCommitted.addListener(listener);
  chrome.webNavigation.onHistoryStateUpdated.addListener(listener);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(listener);
}
