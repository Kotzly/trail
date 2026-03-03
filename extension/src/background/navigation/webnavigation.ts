
import { handleNavigation } from './navigation-handler.js';
import { browser, type Browser } from '@shared/platform/webext.js';

/**
 * Initialize webNavigation event listeners.
 */
export function initWebNavigation(): void {
  const listener = (details: Browser.webNavigation.WebNavigationFramedCallbackDetails) => {
    handleNavigation(details).catch(() => {
      // Navigation handler error — silently ignored.
    });
  };

  browser.webNavigation.onCommitted.addListener(listener);
  browser.webNavigation.onHistoryStateUpdated.addListener(listener);
  browser.webNavigation.onReferenceFragmentUpdated.addListener(listener);
}
