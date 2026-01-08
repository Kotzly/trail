// background/service-worker.ts
import { initMessaging } from './messaging/router';
import { initWebNavigation } from './navigation/webnavigation';
import { initTabsLifecycle } from './tabs/lifecycle';


// Initialize all modules
initMessaging();
initWebNavigation();
initTabsLifecycle();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

console.log('Trail service worker initialized');
