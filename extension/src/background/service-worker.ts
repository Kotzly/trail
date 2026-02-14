// background/service-worker.ts
import { initMessaging } from './messaging/router.js';
import { initWebNavigation } from './navigation/webnavigation.js';
import { initTabsLifecycle } from './tabs/lifecycle.js';
import { syncOpenTabs } from './tabs/sync-open-tabs.js';
import { CommandManager } from '../shared/lib/commands.js';
import { cloudSync } from './services/cloud-sync.js';
import { initBackendConfig } from '../shared/config/backend.js';
import { broadcastAuthRevokedToSiteTabs } from './messaging/site-relay.js';

const AUTH_STORAGE_KEY = 'trail_auth_session' as const;


// Initialize all modules
void initBackendConfig();
initMessaging();
initWebNavigation();
initTabsLifecycle();
void syncOpenTabs();
void CommandManager.init();
cloudSync.init();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !(AUTH_STORAGE_KEY in changes)) {
    return;
  }

  const change = changes[AUTH_STORAGE_KEY];
  const oldToken = (change?.oldValue as { accessToken?: string } | undefined)
    ?.accessToken;
  const nextToken = (change?.newValue as { accessToken?: string } | undefined)
    ?.accessToken;

  if (oldToken && !nextToken) {
    void broadcastAuthRevokedToSiteTabs();
  }
});

const sidePanel = chrome?.sidePanel;

if (sidePanel?.setPanelBehavior) {
  sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.warn('Failed to set side panel behavior', err);
  });
}

console.log('Trail service worker initialized');
