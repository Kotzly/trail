import { browser } from "@shared/platform/webext.js";
import {
  EXTENSION_MESSAGE,
  onExtensionMessage,
  sendExtensionMessage,
} from "@shared/transport/extension-messaging.js";
import { actionService } from "@shared/transport/proxy-clients.js";
import {
  WEBSITE_MESSAGE,
} from "@shared/transport/protocols.js";
import {
  onWebsiteMessage,
  sendWebsiteMessage,
} from "@shared/transport/website-messaging.js";
import { registerWebsiteBridgeRuntime } from "./register-runtime.js";
import { createWebsiteBridge } from "./website-bridge.js";

const IGNORED_WEBSITE_MESSAGE_ERRORS = [
  "No response",
  "Extension context invalidated",
];

function shouldIgnoreWebsiteMessageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return IGNORED_WEBSITE_MESSAGE_ERRORS.some((fragment) => message.includes(fragment));
}

function currentOrigin(): string {
  return window.location.origin;
}

function forwardWebsiteEvent(type: typeof WEBSITE_MESSAGE.EDITOR_MODE_EXITED, data: { editorMode: false }): void {
  void sendWebsiteMessage(type, data, currentOrigin()).catch((error) => {
    if (shouldIgnoreWebsiteMessageError(error)) {
      return;
    }
    console.error("Failed to deliver website event:", String(type), error);
  });
}

const websiteBridge = createWebsiteBridge({
  getVersion: () => browser.runtime.getManifest().version,
  getEditorModeState: () => actionService.getEditorModeState(),
  openPanel: () => sendExtensionMessage(EXTENSION_MESSAGE.OPEN_PANEL),
  enterEditorMode: (treeId) => actionService.enterEditorMode({ treeId }),
  exitEditorMode: () => actionService.exitEditorMode(),
  saveEditorMode: () => actionService.exitEditorMode().then(() => undefined),
  cancelEditorMode: () => actionService.cancelEditorMode().then(() => undefined),
  forwardEditorModeExited: (payload) =>
    forwardWebsiteEvent(WEBSITE_MESSAGE.EDITOR_MODE_EXITED, payload),
});

registerWebsiteBridgeRuntime({
  websiteBridge,
  onWebsiteMessage,
  onExtensionMessage,
});
