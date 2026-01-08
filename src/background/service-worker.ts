// background/service-worker.ts
import { initMessaging } from './messaging/router';
import { initWebNavigation } from './navigation/webnavigation';
import { initTabsLifecycle } from './tabs/lifecycle';
import { initWindowsLifecycle } from './windows/lifecycle';
import { initBootstrap } from './bootstrap/bootstrap';

// Initialize all modules
initMessaging();
initWebNavigation();
initTabsLifecycle();
initWindowsLifecycle();

// Initialize bootstrap (async)
initBootstrap().catch(console.error);

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

console.log('Trail service worker initialized');
