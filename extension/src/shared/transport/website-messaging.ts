import { defineWindowMessaging } from "@webext-core/messaging/page";
import { WEBSITE_MESSAGING_NAMESPACE, type WebsiteProtocolMap } from "./protocols.js";

export const websiteMessaging = defineWindowMessaging<WebsiteProtocolMap>({
  namespace: WEBSITE_MESSAGING_NAMESPACE,
});

export const {
  sendMessage: sendWebsiteMessage,
  onMessage: onWebsiteMessage,
  removeAllListeners: removeAllWebsiteListeners,
} = websiteMessaging;
