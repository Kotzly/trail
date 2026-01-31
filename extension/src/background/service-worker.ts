// background/service-worker.ts
import { initMessaging } from './messaging/router.js';
import { initWebNavigation } from './navigation/webnavigation.js';
import { initTabsLifecycle } from './tabs/lifecycle.js';
import { syncOpenTabs } from './tabs/sync-open-tabs.js';
import { CommandManager } from '../shared/lib/commands.js';


// Initialize all modules
initMessaging();
initWebNavigation();
initTabsLifecycle();
void syncOpenTabs();
void CommandManager.init();

// Side panel behavior is only available in Chromium versions that support the Side Panel API.
// Guard this to avoid runtime errors on older browsers / restricted environments.
const sidePanel = (chrome as any).sidePanel as { setPanelBehavior?: (opts: { openPanelOnActionClick: boolean }) => unknown } | undefined;
if (sidePanel?.setPanelBehavior) {
  try {
    const maybePromise = sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    // setPanelBehavior returns a Promise in modern MV3; keep compatibility with callback-style implementations.
    if (maybePromise && typeof (maybePromise as unknown as Promise<unknown>).catch === 'function') {
      void (maybePromise as unknown as Promise<unknown>).catch((err) => {
        console.warn('Failed to set side panel behavior', err);
      });
    }
  } catch (err) {
    console.warn('Failed to set side panel behavior', err);
  }
} else {
  console.warn('chrome.sidePanel.setPanelBehavior is not available in this browser');
}

console.log('Trail service worker initialized');
