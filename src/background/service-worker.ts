// background/service-worker.ts
import { initMessaging } from './messaging/router.js';
import { initWebNavigation } from './navigation/webnavigation.js';
import { initTabsLifecycle } from './tabs/lifecycle.js';
import { syncOpenTabs } from './tabs/sync-open-tabs.js';
import { notifyUi } from './messaging/ui-notifications.js';


// Initialize all modules
initMessaging();
initWebNavigation();
initTabsLifecycle();
void syncOpenTabs();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

notifyUi({
  message: 'Undo history cleared (service worker restarted)',
  icon: 'AlertTriangle',
  durationMs: 5000,
});

console.log('Trail service worker initialized');
