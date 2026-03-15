
// messaging/router.ts
import {
  RPC_METHOD,
  type HandlerMap,
  type RequestMessage,
  type Err,
  type MessageHandler,
  type RequestType,
  type ResponseMessage,
} from "../../shared/rpc/contracts.js";
import { defineRpcHandlers } from "@shared/rpc/contracts.js";
import type { RpcRequestEnvelope, RpcResponseEnvelope } from "@shared/rpc/schema.js";
import {
  createRpcErrorEnvelope,
  parseRpcRequestEnvelope,
  toRequestMessage,
  toRpcResponseEnvelope,
} from "./rpc-router.js";
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
import { siteMessageHandlers } from "./handlers/site-message-handlers.js";
import { editorHandlers } from "./handlers/editor-handlers.js";
import { oauthAuthHandlers } from "./handlers/oauth-auth-handlers.js";
import { flagsHandlers } from "./handlers/flags-handlers.js";
import { spotlightHandlers } from "./handlers/spotlight-handlers.js";
import { accountPageHandlers } from "./handlers/account-page-handlers.js";
import { browser, type RuntimeMessageSender } from '@shared/platform/webext.js';

type AnyResponse = ResponseMessage<RequestType>;
type AnyHandler = (
  message: RequestMessage,
  sender: RuntimeMessageSender,
) => Promise<AnyResponse> | AnyResponse;

function err(error: string): Err {
  return { success: false, error };
}

const TYPED_TYPES = new Set<string>(Object.values(RPC_METHOD));

const outboundOnlyHandlers = defineRpcHandlers({
  [RPC_METHOD.TREE_UPDATED]: async (): Promise<ResponseMessage<typeof RPC_METHOD.TREE_UPDATED>> =>
    err("TREE_UPDATED is outbound-only"),
  [RPC_METHOD.TREES_UPDATED]: async (): Promise<ResponseMessage<typeof RPC_METHOD.TREES_UPDATED>> =>
    err("TREES_UPDATED is outbound-only"),
  [RPC_METHOD.TAGS_UPDATED]: async (): Promise<ResponseMessage<typeof RPC_METHOD.TAGS_UPDATED>> =>
    err("TAGS_UPDATED is outbound-only"),
  [RPC_METHOD.NOTIFY]: async (): Promise<ResponseMessage<typeof RPC_METHOD.NOTIFY>> =>
    err("NOTIFY is outbound-only"),
  [RPC_METHOD.SYNC_STATUS_UPDATED]: async (): Promise<ResponseMessage<typeof RPC_METHOD.SYNC_STATUS_UPDATED>> =>
    err("SYNC_STATUS_UPDATED is outbound-only"),
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

  async function dispatch(
    message: RequestMessage,
    sender: RuntimeMessageSender,
  ): Promise<AnyResponse> {
    if (!TYPED_TYPES.has(message.type)) {
      return err(`Unknown message type: ${message.type}`);
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

  async function dispatchRpcEnvelope(
    rawMessage: unknown,
    sender: RuntimeMessageSender,
  ): Promise<RpcResponseEnvelope> {
    const request = parseRpcRequestEnvelope(rawMessage);
    if (!request) {
      return createRpcErrorEnvelope(
        { id: "invalid", method: "invalid" },
        "Invalid RPC request envelope",
      );
    }

    const requestMessage = toRequestMessage(request);
    if (!TYPED_TYPES.has(requestMessage.type)) {
      return createRpcErrorEnvelope(
        { id: request.id, method: request.method },
        `Unknown message type: ${requestMessage.type}`,
      );
    }

    const response = await dispatch(requestMessage, sender);
    return toRpcResponseEnvelope(request, response);
  }

  function listen() {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      dispatchRpcEnvelope(message, sender)
        .catch((e) => createRpcErrorEnvelope(
          { id: "crash", method: "crash" },
          e instanceof Error && e.message ? e.message : "Internal error",
        ))
        .then(sendResponse);
      return true; // keep channel open for async response
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
    .merge(siteMessageHandlers)
    .merge(oauthAuthHandlers)
    .merge(editorHandlers)
    .merge(flagsHandlers)
    .merge(spotlightHandlers)
    .merge(accountPageHandlers)
    .listen();
}
