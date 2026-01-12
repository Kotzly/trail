// background/service-worker.ts
import { initMessaging } from './messaging/router.js';
import { initWebNavigation } from './navigation/webnavigation.js';
import { initTabsLifecycle } from './tabs/lifecycle.js';
import { syncOpenTabs } from './tabs/sync-open-tabs.js';


// Initialize all modules
initMessaging();
initWebNavigation();
initTabsLifecycle();
void syncOpenTabs();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

console.log('Trail service worker initialized');
