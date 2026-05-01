import type { GetReturnType, MaybePromise, Message } from "@webext-core/messaging";
import {
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
  const { websiteBridge, onWebsiteMessage } = deps;

  onWebsiteMessage(WEBSITE_MESSAGE.PING, () => websiteBridge.ping());
  onWebsiteMessage(WEBSITE_MESSAGE.OPEN_PANEL, () => websiteBridge.openPanel());
}
