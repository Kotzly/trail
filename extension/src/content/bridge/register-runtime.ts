import type {
  GetReturnType,
  MaybePromise,
  Message,
} from "@webext-core/messaging";
import {
  EXTENSION_MESSAGE,
  WEBSITE_MESSAGE,
  type ExtensionProtocolMap,
  type WebsiteProtocolMap,
} from "@shared/transport/protocols.js";
import type { createWebsiteBridge } from "./website-bridge.js";

type WebsiteMessageRegistrar = <TType extends keyof WebsiteProtocolMap>(
  type: TType,
  handler: (
    message: Message<WebsiteProtocolMap, TType>,
  ) => void | MaybePromise<GetReturnType<WebsiteProtocolMap[TType]>>,
) => void;

type ExtensionMessageRegistrar = <TType extends keyof ExtensionProtocolMap>(
  type: TType,
  handler: (
    message: Message<ExtensionProtocolMap, TType>,
  ) => void | MaybePromise<GetReturnType<ExtensionProtocolMap[TType]>>,
) => void;

export type WebsiteBridgeRuntime = ReturnType<typeof createWebsiteBridge>;

export function registerWebsiteBridgeRuntime(deps: {
  websiteBridge: WebsiteBridgeRuntime;
  onWebsiteMessage: WebsiteMessageRegistrar;
  onExtensionMessage: ExtensionMessageRegistrar;
}): void {
  const { websiteBridge, onWebsiteMessage, onExtensionMessage } = deps;

  onWebsiteMessage(WEBSITE_MESSAGE.PING, () => websiteBridge.ping());
  onWebsiteMessage(WEBSITE_MESSAGE.OPEN_PANEL, () => websiteBridge.openPanel());
  onWebsiteMessage(WEBSITE_MESSAGE.ENTER_EDITOR_MODE, ({ data }) =>
    websiteBridge.enterEditorMode(data.treeId),
  );
  onWebsiteMessage(WEBSITE_MESSAGE.EXIT_EDITOR_MODE, () => websiteBridge.exitEditorMode());
  onWebsiteMessage(WEBSITE_MESSAGE.SAVE_EDITOR_MODE, () => websiteBridge.saveEditorMode());
  onWebsiteMessage(WEBSITE_MESSAGE.CANCEL_EDITOR_MODE, () => websiteBridge.cancelEditorMode());
  onExtensionMessage(EXTENSION_MESSAGE.SITE_EDITOR_MODE_EXITED, ({ data }) =>
    websiteBridge.handleEditorModeExited(data),
  );
}
