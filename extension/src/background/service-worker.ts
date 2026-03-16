// background/service-worker.ts
import { initMessaging } from './messaging/router.js';
import { initWebNavigation } from './navigation/webnavigation.js';
import { initTabsLifecycle } from './tabs/lifecycle.js';
import { syncOpenTabs } from './tabs/sync-open-tabs.js';
import { CommandManager } from '@shared/lib/commands.js';
import { syncEngine } from './services/sync/engine.js';
import { initBackendConfig } from '@shared/config/backend.js';
import { authOrchestrator } from './services/auth-orchestrator.js';
import { accountKeeper } from './services/account-keeper.js';
import { authPolicyKeeper } from './services/auth-policy-keeper.js';
import { browser } from '@shared/platform/webext.js';
import { initSpotlightCommand } from './spotlight-command.js';
import { initOffscreenGraphManager } from './services/offscreen-graph-manager.js';

// Catch unhandled promise rejections so they don't silently disappear
// in the service worker context.
self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  console.error('Unhandled rejection in service worker:', event.reason);
});

// Initialize all modules
void initBackendConfig();
initMessaging();
initWebNavigation();
initTabsLifecycle();
void syncOpenTabs();
void CommandManager.init();
syncEngine.init();
authOrchestrator.init();
accountKeeper.init();
void authPolicyKeeper.getPolicy();
initSpotlightCommand();
initOffscreenGraphManager();

const sidePanel = (browser as unknown as {
  sidePanel?: {
    setPanelBehavior?: (behavior: { openPanelOnActionClick: boolean }) => Promise<void> | void;
  };
})?.sidePanel;

if (sidePanel?.setPanelBehavior) {
  void Promise.resolve(sidePanel.setPanelBehavior({ openPanelOnActionClick: true })).catch((err: unknown) => {
    console.warn('Failed to set side panel behavior', err);
  });
}

// Service worker initialized.
