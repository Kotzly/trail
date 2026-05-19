// background/service-worker.ts
import { initWebNavigation } from "./navigation/webnavigation.js";
import { initTabsLifecycle } from "./tabs/lifecycle.js";
import { syncOpenTabs } from "./tabs/sync-open-tabs.js";
import { CommandManager } from "@shared/lib/commands.js";
import { createLogger } from "@shared/lib/logger.js";
import { warmLayoutPositions } from "./services/layout-precompute.js";
import { registerProxyServices } from "./transport/register-proxy-services.js";
import { registerExtensionMessaging } from "./transport/register-extension-messaging.js";
import { captureError, captureEvent, initObservability } from "@shared/lib/observability.js";
import { initAuth, subscribeAuthState, getAuthState } from "@shared/auth/auth-orchestrator.js";
import {
  handlePullAlarm,
  periodicPull,
  startSyncEngine,
  SYNC_PULL_ALARM,
} from "./sync/sync-engine.js";
import { maybeReclaimStorage } from "./services/storage-retention.js";
import { wireStorageRetention } from "./services/storage-retention-wiring.js";
import { EXTENSION_MESSAGE, fireExtensionEvent } from "@shared/transport/extension-messaging.js";
import { treeStorage } from "./services/tree-storage.js";
import { tabManager } from "./state/tab-manager.js";
import { hydrateNavPatterns } from "./navigation/nav-pattern-tracker.js";
import { getSupabaseClient } from "@shared/lib/supabase.js";
import {
  pendingShareImportItem,
  pendingWelcomeBackVersionItem,
} from "@shared/config/storage-items.js";
import { importSharedTrail } from "@features/sharing/share-api.js";

const log = createLogger("service-worker");

const AUTH_REFRESH_ALARM = "trail-auth-refresh";
const AUTH_REFRESH_PERIOD_MINUTES = 30;

// Catch unhandled promise rejections so they don't silently disappear
// in the service worker context.
self.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  log.error("Unhandled rejection in service worker", {
    error: event.reason instanceof Error ? event.reason.message : String(event.reason),
  });
  captureError(event.reason, { surface: "background", kind: "unhandled_rejection" });
});

void initObservability("background");

// chrome.alarms.onAlarm MUST be registered synchronously at module top
// level (not inside an async callback) so Chrome can replay the event
// to wake the SW. The handler itself is allowed to be async.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_PULL_ALARM) {
    void handlePullAlarm().catch((error) => {
      captureError(error, { surface: "background", kind: "pull_alarm" });
    });
    return;
  }
  if (alarm.name === AUTH_REFRESH_ALARM) {
    void refreshAuthSession().catch((error) => {
      captureError(error, { surface: "background", kind: "auth_refresh_alarm" });
    });
  }
});

// Quota-driven storage retention: any tree-related write probes the
// chrome.storage.local quota. When usage crosses the high-water
// mark, the oldest stored trees are demoted to cloud-only stubs.
// `maybeReclaimStorage` throttles itself, so this listener can fire
// freely.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  for (const key of Object.keys(changes)) {
    if (key === "trail_tree" || key === "trail_tree_archives" || key.startsWith("trail_ar_")) {
      maybeReclaimStorage();
      return;
    }
  }
});

async function refreshAuthSession(): Promise<void> {
  if (getAuthState().status !== "signed-in") return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.refreshSession();
  if (error) {
    log.warn("refreshSession failed", { error: error.message });
  }
}

// Install / update tracking — fires once per install and once per version change.
// Also kicks off local schema migrations so the extension starts each
// upgrade with its persisted shape matching the current code.
chrome.runtime.onInstalled.addListener((details) => {
  const currentVersion = chrome.runtime.getManifest().version;
  if (details.reason === "install") {
    captureEvent("install", { version: currentVersion });
  } else if (details.reason === "update") {
    const previousVersion = details.previousVersion ?? null;
    captureEvent("update", { version: currentVersion, previousVersion });
    // The 0.9.x line was the last pre-Supabase release. Surface a
    // one-time welcome-back dialog in the sidepanel so those users
    // know to sign in and that their local trees are intact. Cleared
    // by the dialog itself on dismiss/CTA.
    if (previousVersion?.startsWith("0.9.") && currentVersion.startsWith("1.0.")) {
      void pendingWelcomeBackVersionItem.setValue(currentVersion);
    }
  }
  // Run migrations on install AND update; the singleflight inside
  // runMigrations dedupes if the module-load path also fires.
  void import("./services/migrations.js").then(({ runMigrations }) => runMigrations());

  // (Re)create the auth-refresh alarm on install/update so existing
  // installs pick it up without needing a user action.
  chrome.alarms.create(AUTH_REFRESH_ALARM, {
    periodInMinutes: AUTH_REFRESH_PERIOD_MINUTES,
  });
});

// MV3 service workers are evicted aggressively. Flush pending tree saves
// before termination so the 1.5s debounced writes don't disappear with
// the worker. This is best-effort — Chrome may terminate before the
// flush resolves — but it closes the common-case data-loss window.
chrome.runtime.onSuspend.addListener(() => {
  log.info("Service worker suspending — flushing pending saves");
  void treeStorage.flushSaveNow();
  void CommandManager.flushNow?.();
});

// Wire production deps for the storage-retention module before any
// chrome.storage write can fire the onChanged listener above.
wireStorageRetention();

registerProxyServices();
registerExtensionMessaging();
initWebNavigation();
initTabsLifecycle();

// Hydrate lastNodeByTab from session storage BEFORE syncOpenTabs so
// opener-based parent inference works immediately on SW wake. Also
// wire up tree-level integrations so TabManager can validate nodeIds
// and respond to deletions.
tabManager.setTreeAccessor(() => treeStorage.cachedTree);
void Promise.all([tabManager.hydrate(), hydrateNavPatterns()]).then(async () => {
  const tree = await treeStorage.getOrCreateTree();
  tree.onNodesDeleted((ids) => tabManager.onNodesDeleted(ids));
  await syncOpenTabs();
});
void CommandManager.init();

// Chrome: route toolbar-action clicks to the sidepanel. Tree-shake the
// whole branch out of Firefox builds so `addons-linter` doesn't flag
// the sidePanel call site as an unsupported API.
if (!import.meta.env.FIREFOX && chrome.sidePanel?.setPanelBehavior) {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err: unknown) => {
    log.warn("Failed to set side panel behavior", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

// Firefox has no `chrome.sidePanel` and no "open panel on action click"
// affordance — clicking the toolbar button only fires `onClicked`. Wire
// that to toggle the sidebar so the toolbar icon does what users expect.
// Must register synchronously at SW startup so cold-start clicks land.
if (import.meta.env.FIREFOX) {
  const actionApi =
    (chrome as unknown as { browserAction?: typeof chrome.action }).browserAction ?? chrome.action;
  const sidebarAction = (
    chrome as unknown as {
      sidebarAction?: { toggle?: () => Promise<void> | void };
    }
  ).sidebarAction;
  if (actionApi?.onClicked && sidebarAction?.toggle) {
    actionApi.onClicked.addListener(() => {
      try {
        const result = sidebarAction.toggle?.();
        if (result && typeof (result as Promise<void>).catch === "function") {
          (result as Promise<void>).catch((err: unknown) => {
            log.warn("sidebarAction.toggle failed", {
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }
      } catch (err) {
        log.warn("sidebarAction.toggle threw", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }
}

// Pre-compute layout positions so sidepanel opens instantly
void warmLayoutPositions();

// Auth + sync — no-op when env vars missing or user not signed in.
// Ensure the alarm exists even on regular SW wake (onInstalled only
// fires on install/update).
chrome.alarms.create(AUTH_REFRESH_ALARM, {
  periodInMinutes: AUTH_REFRESH_PERIOD_MINUTES,
});

void initAuth().then((state) => {
  fireExtensionEvent(EXTENSION_MESSAGE.AUTH_STATE, state);
  void consumePendingShareImport(state);
  subscribeAuthState((next) => {
    fireExtensionEvent(EXTENSION_MESSAGE.AUTH_STATE, next);
    void consumePendingShareImport(next);
  });
  startSyncEngine();
});

/**
 * If a share-import was queued while signed-out and the user is now
 * signed-in, execute the import and clear the slot. Errors are
 * non-fatal — the user can re-click the Import button on the marketing
 * page. Idempotent: re-runs of this function after the slot is cleared
 * are no-ops.
 */
async function consumePendingShareImport(state: { status: string }): Promise<void> {
  if (state.status !== "signed-in") return;
  const pending = await pendingShareImportItem.getValue();
  if (!pending) return;
  // 1-hour staleness window: stale pending codes are dropped silently
  // so an unrelated sign-in days later doesn't trigger a surprise import.
  const ONE_HOUR_MS = 60 * 60 * 1000;
  if (Date.now() - pending.queuedAt > ONE_HOUR_MS) {
    await pendingShareImportItem.setValue(null);
    return;
  }
  const result = await importSharedTrail(pending.code);
  await pendingShareImportItem.setValue(null);
  if (result.ok) {
    captureEvent("share_import_pending_consumed");
    void periodicPull().catch((err) => {
      log.warn("post-pending-import pull failed", { error: String(err) });
    });
  } else {
    log.info("pending share import failed", { error: result.error });
  }
}

// Service worker initialized.
