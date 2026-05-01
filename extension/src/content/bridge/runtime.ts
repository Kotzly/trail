import { browser } from "@shared/platform/webext.js";
import {
  EXTENSION_MESSAGE,
  onExtensionMessage,
  sendExtensionMessage,
} from "@shared/transport/extension-messaging.js";
import { onWebsiteMessage } from "@shared/transport/website-messaging.js";
import { registerWebsiteBridgeRuntime } from "./register-runtime.js";
import { createWebsiteBridge } from "./website-bridge.js";

const websiteBridge = createWebsiteBridge({
  getVersion: () => browser.runtime.getManifest().version,
  openPanel: () => sendExtensionMessage(EXTENSION_MESSAGE.OPEN_PANEL),
});

registerWebsiteBridgeRuntime({
  websiteBridge,
  onWebsiteMessage,
  onExtensionMessage,
});
