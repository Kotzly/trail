"use client";

import { defineWindowMessaging } from "@webext-core/messaging/page";
import {
  WEBSITE_MESSAGING_NAMESPACE,
  type WebsiteProtocolMap,
} from "./protocol";

/**
 * Singleton page-side messenger for the `trail-bridge-v1` window
 * postMessage protocol. The extension content script registers its
 * counterpart in `extension/src/content/bridge/runtime.ts`. Using the
 * library directly keeps the envelope shape — `type`, `instanceId`,
 * `senderOrigin` — in lock-step with the extension; the previous
 * hand-rolled envelope drifted and silently dropped every reply.
 */
const messenger = defineWindowMessaging<WebsiteProtocolMap>({
  namespace: WEBSITE_MESSAGING_NAMESPACE,
});

export const sendBridgeMessage = messenger.sendMessage;
