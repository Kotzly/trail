
// messaging/router.ts
import {
  MSG,
  type HandlerMap,
  type RequestMessage,
  type Err,
  type MessageHandler,
  type RequestType,
  type ResponseMessage,
} from "../../shared/types/messages.js";
import { defineHandlers } from "../../shared/types/messages.js";
import { navigationHandlers } from "./handlers/navigation-handlers.js";
import { tabHandlers } from "./handlers/tab-handlers.js";
import { settingsHandlers } from "./handlers/settings-handlers.js";
import { contentHandlers } from "./handlers/content-handlers.js";
import { treeHandlers } from "./handlers/tree-handlers.js";
import { commandHandlers } from "./handlers/undo-handlers.js";
import { pinHandlers } from "./handlers/pin-handlers.js";
import { tagHandlers } from "./handlers/tag-handlers.js";
import { tagDefHandlers } from "./handlers/tag-def-handlers.js";
import { panelHandlers } from "./handlers/panel-handlers.js";

type AnyResponse = ResponseMessage<RequestType>;
type AnyHandler = (message: RequestMessage, sender: chrome.runtime.MessageSender) => Promise<AnyResponse> | AnyResponse;

function err(error: string): Err {
  return { success: false, error };
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

const TYPED_TYPES = new Set<string>(Object.values(MSG));

function isRequestMessage(x: unknown): x is RequestMessage {
  if (!isObject(x)) return false;
  const t = x["type"];
  return typeof t === "string" && TYPED_TYPES.has(t);
}

const outboundOnlyHandlers = defineHandlers({
  [MSG.TREE_UPDATED]: async (): Promise<ResponseMessage<typeof MSG.TREE_UPDATED>> =>
    err("TREE_UPDATED is outbound-only"),
  [MSG.TREES_UPDATED]: async (): Promise<ResponseMessage<typeof MSG.TREES_UPDATED>> =>
    err("TREES_UPDATED is outbound-only"),
  [MSG.TAGS_UPDATED]: async (): Promise<ResponseMessage<typeof MSG.TAGS_UPDATED>> =>
    err("TAGS_UPDATED is outbound-only"),
  [MSG.NOTIFY]: async (): Promise<ResponseMessage<typeof MSG.NOTIFY>> =>
    err("NOTIFY is outbound-only"),
} satisfies HandlerMap);

function createMessageRouter() {
  const handlers: HandlerMap = {};

  function merge(map: HandlerMap) {
    Object.assign(handlers, map);
    return api;
  }

  function getHandler<T extends RequestType>(type: T): MessageHandler<T> | undefined {
    return handlers[type] as MessageHandler<T> | undefined;
  }

  async function dispatch(message: unknown, sender: chrome.runtime.MessageSender): Promise<AnyResponse> {
    if (!isRequestMessage(message)) {
      if (isObject(message) && typeof message.type === "string") {
        return err(`Unknown message type: ${message.type}`);
      }
      return err("Invalid message");
    }

    const fn = getHandler(message.type);
    if (!fn) return err(`No handler registered for message type: ${message.type}`);

    try {
      return await fn(message, sender);
    } catch (e: unknown) {
      console.error("Message handler crashed:", message.type, e);
      return err(e instanceof Error ? e.message : "Unknown error");
    }
  }

  function listen() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      (async () => {
        const res = await dispatch(message, sender);
        sendResponse(res);
      })();
      return true; // Keep channel open for async response
    });
  }

  const api = { merge, dispatch, listen };
  return api;
}

/**
 * Centralized message router (no legacy).
 */
export function initMessaging(): void {
  createMessageRouter()
    .merge(outboundOnlyHandlers)
    .merge(navigationHandlers)
    .merge(tabHandlers)
    .merge(settingsHandlers)
    .merge(contentHandlers)
    .merge(treeHandlers)
    .merge(commandHandlers)
    .merge(pinHandlers)
    .merge(tagHandlers)
    .merge(tagDefHandlers)
    .merge(panelHandlers)
    .listen();
}
