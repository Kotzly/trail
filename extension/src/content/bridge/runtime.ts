import { browser } from "@shared/platform/webext.js";
import {
  EXTENSION_MESSAGE,
  onExtensionMessage,
  sendExtensionMessage,
} from "@shared/transport/extension-messaging.js";
import { onWebsiteMessage } from "@shared/transport/website-messaging.js";
import { BRIDGE_CAPABILITIES } from "@shared/transport/capabilities.js";
import { registerWebsiteBridgeRuntime } from "./register-runtime.js";
import { createWebsiteBridge } from "./website-bridge.js";

const websiteBridge = createWebsiteBridge({
  getVersion: () => browser.runtime.getManifest().version,
  // Content scripts can't access auth state directly; for v1 we report
  // `false` and rely on the import RPC to surface the auth gate. The
  // marketing page still has useful info via `capabilities` to decide
  // whether to show the Import button at all.
  isAuthenticated: () => false,
  capabilities: BRIDGE_CAPABILITIES,
  openPanel: () => sendExtensionMessage(EXTENSION_MESSAGE.OPEN_PANEL),
  importSharedTrail: (req) =>
    sendExtensionMessage(EXTENSION_MESSAGE.IMPORT_SHARED_TRAIL_FROM_SITE, req),
});

registerWebsiteBridgeRuntime({
  websiteBridge,
  onWebsiteMessage,
  onExtensionMessage,
});
