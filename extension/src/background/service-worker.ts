// background/service-worker.ts
import { initMessaging } from "./messaging/router.js";
import { initWebNavigation } from "./navigation/webnavigation.js";
import { initTabsLifecycle } from "./tabs/lifecycle.js";
import { syncOpenTabs } from "./tabs/sync-open-tabs.js";
import { CommandManager } from "@shared/lib/commands.js";
import { syncEngine } from "./services/sync/engine.js";
import { initBackendConfig } from "@shared/config/backend.js";
import { authOrchestrator } from "./services/auth-orchestrator.js";
import { accountKeeper } from "./services/account-keeper.js";
import { authPolicyKeeper } from "./services/auth-policy-keeper.js";
import { initSpotlightCommand } from "./spotlight-command.js";
import { initOffscreenGraphManager } from "./services/offscreen-graph-manager.js";
import { createLogger } from "@shared/lib/logger.js";

const log = createLogger("service-worker");

// Catch unhandled promise rejections so they don't silently disappear
// in the service worker context.
self.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  log.error("Unhandled rejection in service worker", { error: event.reason instanceof Error ? event.reason.message : String(event.reason) });
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

if (chrome.sidePanel?.setPanelBehavior) {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err: unknown) => {
    log.warn("Failed to set side panel behavior", { error: err instanceof Error ? err.message : String(err) });
  });
}

// Service worker initialized.
