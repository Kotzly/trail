// background/service-worker.ts
import { initMessaging } from './messaging/router.js';
import { initWebNavigation } from './navigation/webnavigation.js';
import { initTabsLifecycle } from './tabs/lifecycle.js';


// Initialize all modules
initMessaging();
initWebNavigation();
initTabsLifecycle();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

console.log('Trail service worker initialized');
