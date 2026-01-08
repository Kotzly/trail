
// messaging/router.ts
import {
  MSG,
  type HandlerMap,
  type RequestMessage,
  type Response,
  defineHandlers,
} from "../../shared/types/messages.js";

type AnyResponse = Response<any>;
type AnyHandler = (message: any, sender: chrome.runtime.MessageSender) => Promise<AnyResponse> | AnyResponse;

function err(error: string): AnyResponse {
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

// No-op handler that returns success for requests
const noopHandler: AnyHandler = async () => ({ success: false, error: "Not implemented" });

// No-op error for TREE_UPDATED
const noopTreeUpdated: AnyHandler = async () => err("TREE_UPDATED is outbound-only");

const typedHandlers = defineHandlers({
  [MSG.NAVIGATE_TO]: noopHandler,
  [MSG.UNDO]: noopHandler,
  [MSG.REDO]: noopHandler,
  [MSG.COMMAND_STATE]: noopHandler,
  [MSG.GET_TABS_FOR_NODE]: noopHandler,
  [MSG.SAVE_SETTINGS]: noopHandler,
  [MSG.GET_SETTINGS]: noopHandler,
  [MSG.TITLE_CHANGED]: noopHandler,
  [MSG.TREE_UPDATED]: noopTreeUpdated,
} satisfies HandlerMap);

function createMessageRouter() {
  const handlers: Record<string, AnyHandler> = Object.create(null);

  function merge(map: HandlerMap) {
    for (const [type, fn] of Object.entries(map)) {
      if (!fn) continue;
      handlers[type] = fn as unknown as AnyHandler;
    }
    return api;
  }

  async function dispatch(message: unknown, sender: chrome.runtime.MessageSender): Promise<AnyResponse> {
    if (!isRequestMessage(message)) {
      if (isObject(message) && typeof message.type === "string") {
        return err(`Unknown message type: ${message.type}`);
      }
      return err("Invalid message");
    }

    const fn = handlers[message.type];
    if (!fn) return err(`No handler registered for message type: ${message.type}`);

    try {
      return await fn(message, sender);
    } catch (e: any) {
      console.error("Message handler crashed:", message.type, e);
      return err(e?.message ?? "Unknown error");
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
    .merge(typedHandlers)
    .listen();
}
