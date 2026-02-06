// background/service-worker.ts
import { initMessaging } from './messaging/router.js';
import { initWebNavigation } from './navigation/webnavigation.js';
import { initTabsLifecycle } from './tabs/lifecycle.js';
import { syncOpenTabs } from './tabs/sync-open-tabs.js';
import { CommandManager } from '../shared/lib/commands.js';
import { cloudSync } from './services/cloud-sync.js';
import { initBackendConfig } from '../shared/config/backend.js';


// Initialize all modules
void initBackendConfig();
initMessaging();
initWebNavigation();
initTabsLifecycle();
void syncOpenTabs();
void CommandManager.init();
cloudSync.init();

const sidePanel = chrome?.sidePanel;

if (sidePanel?.setPanelBehavior) {
  sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.warn('Failed to set side panel behavior', err);
  });
}

console.log('Trail service worker initialized');
