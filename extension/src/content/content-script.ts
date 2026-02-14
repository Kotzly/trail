import { isAllowedSiteOrigin } from '../shared/config/site-origins.js';


/**
 * Content script for Trail.
 *
 * Responsibilities:
 * 1. Track title / favicon changes and report to background.
 * 2. Bridge postMessage between the Trail account site and the extension
 *    background, enforcing the security layer (origin, schema, TTL, nonce).
 *
 * ⚠ No heavy dependencies here (no Zod, no large libs) — this script is
 * injected only on trusted Trail site origins.
 */

// ---------------------------------------------------------------------------
// Brand types (mirrors shared/types/ids.ts without importing)
// ---------------------------------------------------------------------------

type Brand<T, B extends string> = T & { readonly __brand: B };

type Url = Brand<string, "Url">;
type Title = Brand<string, "Title">;
type FaviconUrl = Brand<string, "FaviconUrl">;

// ---------------------------------------------------------------------------
// Internal messaging types (background ↔ content script)
// ---------------------------------------------------------------------------

type TitleOrFaviconChangedMessage = {
  type: typeof RPC_METHOD.TITLE_OR_FAVICON_CHANGED;
  url: Url;
  title?: Title;
  favicon?: FaviconUrl;
};

type OpenPanelMessage = {
  type: typeof RPC_METHOD.OPEN_PANEL;
};

/** Messages forwarded from site → background via content script. */
type SiteForwardMessage = {
  type: typeof RPC_METHOD.SITE_MESSAGE_FORWARD;
  siteMessageType: string;
  payload: Record<string, unknown>;
  requestId: string;
};

type RequestMessage =
  | TitleOrFaviconChangedMessage
  | OpenPanelMessage
  | SiteForwardMessage;

type RequestType = RequestMessage["type"];

type MessageByType<T extends RequestType> = Extract<RequestMessage, { type: T }>;

type Ok<T = void> = { success: true; data: T };
type Err = { success: false; error: string };
type MessageResponse<T = void> = Ok<T> | Err;

type ResponseDataByType = {
  [RPC_METHOD.TITLE_OR_FAVICON_CHANGED]: void;
  [RPC_METHOD.OPEN_PANEL]: void;
  [RPC_METHOD.SITE_MESSAGE_FORWARD]: { responsePayload?: Record<string, unknown> };
};

type ResponseMessage<T extends RequestType> = MessageResponse<ResponseDataByType[T]>;

const RPC_METHOD = {
  TITLE_OR_FAVICON_CHANGED: "TITLE_OR_FAVICON_CHANGED",
  OPEN_PANEL: "OPEN_PANEL",
  SITE_MESSAGE_FORWARD: "SITE_MESSAGE_FORWARD",
} as const;

const rpc = {
  titleOrFaviconChanged(payload: {
    url: Url;
    title?: Title;
    favicon?: FaviconUrl;
  }): TitleOrFaviconChangedMessage {
    return { type: RPC_METHOD.TITLE_OR_FAVICON_CHANGED, ...payload };
  },
  openPanel(): OpenPanelMessage {
    return { type: RPC_METHOD.OPEN_PANEL };
  },
  siteMessageForward(
    siteMessageType: string,
    payload: Record<string, unknown>,
    requestId: string,
  ): SiteForwardMessage {
    return { type: RPC_METHOD.SITE_MESSAGE_FORWARD, siteMessageType, payload, requestId };
  },
};

// ---------------------------------------------------------------------------
// Site ↔ Extension postMessage constants
// ---------------------------------------------------------------------------

const SITE_SOURCE = "trail-site" as const;
const EXTENSION_SOURCE = "trail-extension" as const;

/** Known site → extension message types. */
const KNOWN_SITE_TYPES = new Set<string>([
  "PING",
  "OPEN_TRAIL_PANEL",
  "ENTER_EDITOR_MODE",
  "EXIT_EDITOR_MODE",
  "SAVE_EDITOR_MODE",
  "CANCEL_EDITOR_MODE",
  "REQUEST_AUTH_BRIDGE_CODE",
  "WEB_AUTH_BRIDGE_CODE",
  "SELECT_NODE",
  "UPDATE_NODE_METADATA",
  "AUTH_REVOKED",
]);

/** TTL window — messages older than 30 s are rejected. */
const MESSAGE_TTL_MS = 30_000;

/** Max nonce set size for anti-replay. */
const MAX_NONCE_SET_SIZE = 100;

// ---------------------------------------------------------------------------
// Security: nonce tracking (anti-replay)
// ---------------------------------------------------------------------------

/** Insertion-ordered set. Oldest entries evicted when size > MAX. */
const seenNonces: string[] = [];
const nonceSet = new Set<string>();

function hasSeenNonce(nonce: string): boolean {
  return nonceSet.has(nonce);
}

function recordNonce(nonce: string): void {
  if (nonceSet.has(nonce)) return;
  nonceSet.add(nonce);
  seenNonces.push(nonce);
  while (seenNonces.length > MAX_NONCE_SET_SIZE) {
    const oldest = seenNonces.shift();
    if (oldest) nonceSet.delete(oldest);
  }
}

// ---------------------------------------------------------------------------
// Lightweight message validation (no Zod — keep content script lean)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidUUID(value: unknown): value is string {
  if (typeof value !== "string") return false;
  // RFC 4122 UUID pattern (v4-like, loose)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Validate that `data` looks like a valid site → extension message.
 * Returns the validated object or null.
 */
function validateSiteMessage(
  data: unknown,
):
  | {
      source: typeof SITE_SOURCE;
      type: string;
      requestId: string;
      timestamp: number;
      [key: string]: unknown;
    }
  | null {
  if (!isRecord(data)) return null;
  if (data.source !== SITE_SOURCE) return null;
  if (typeof data.type !== "string") return null;
  if (!KNOWN_SITE_TYPES.has(data.type)) return null;
  if (!isValidUUID(data.requestId)) return null;
  if (typeof data.timestamp !== "number" || !Number.isFinite(data.timestamp))
    return null;
  return data as {
    source: typeof SITE_SOURCE;
    type: string;
    requestId: string;
    timestamp: number;
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// Chrome messaging helpers
// ---------------------------------------------------------------------------

const IGNORED_ERROR_FRAGMENTS = [
  "The message port closed before a response was received.",
  "Extension context invalidated",
  "Receiving end does not exist",
];
const RPC_VERSION = 2 as const;

function shouldIgnoreRuntimeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return IGNORED_ERROR_FRAGMENTS.some((fragment) =>
    message.includes(fragment),
  );
}

function createRpcId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toRpcRequestEnvelope<T extends RequestType>(message: MessageByType<T>) {
  const { type, ...input } = message as Record<string, unknown>;
  return {
    v: RPC_VERSION,
    kind: "rpc-request" as const,
    id: createRpcId(),
    method: type as T,
    input,
  };
}

function toResponseMessage<T extends RequestType>(
  request: ReturnType<typeof toRpcRequestEnvelope<T>>,
  rawResponse: unknown,
): ResponseMessage<T> {
  if (!isRecord(rawResponse)) {
    return { success: false, error: "Invalid RPC response envelope" };
  }

  if (
    rawResponse.v !== RPC_VERSION ||
    rawResponse.kind !== "rpc-response" ||
    rawResponse.id !== request.id ||
    rawResponse.method !== request.method
  ) {
    return { success: false, error: "Mismatched RPC response envelope" };
  }

  if (rawResponse.success === true) {
    return {
      success: true,
      data: (rawResponse.data ?? undefined) as ResponseDataByType[T],
    };
  }
  if (rawResponse.success === false && typeof rawResponse.error === "string") {
    return { success: false, error: rawResponse.error };
  }
  return { success: false, error: "Invalid RPC response envelope" };
}

function sendMessage<T extends RequestType>(
  message: MessageByType<T>,
): Promise<ResponseMessage<T>> {
  const request = toRpcRequestEnvelope(message);
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.id) {
      return reject(new Error("Extension context invalidated"));
    }
    try {
      chrome.runtime.sendMessage(request, (response: unknown) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(err);
        resolve(toResponseMessage(request, response));
      });
    } catch (error) {
      reject(error);
    }
  });
}

function fireAndForget<T extends RequestType>(
  message: MessageByType<T>,
): void {
  sendMessage(message).catch((error) => {
    if (shouldIgnoreRuntimeError(error)) return;
    console.debug("Failed to send message:", message.type, error);
  });
}

function notifyTitleOrFaviconChange(payload: {
  url: Url;
  title?: Title;
  favicon?: FaviconUrl;
}): void {
  fireAndForget(rpc.titleOrFaviconChanged(payload));
}

// ---------------------------------------------------------------------------
// Extension → Site postMessage helper
// ---------------------------------------------------------------------------

function postExtensionMessage(
  payload: Record<string, unknown>,
  origin: string,
): void {
  const message = {
    source: EXTENSION_SOURCE,
    timestamp: Date.now(),
    ...payload,
  };
  window.postMessage(message, origin);
}

// ---------------------------------------------------------------------------
// Site → Extension message handler
// ---------------------------------------------------------------------------

function handleSiteMessage(event: MessageEvent): void {
  // Only accept messages from the same window.
  if (event.source !== window) return;

  // Strict origin check — no hostname fallback.
  if (!isAllowedSiteOrigin(event.origin)) return;

  // Lightweight structural validation.
  const siteMessage = validateSiteMessage(event.data);
  if (!siteMessage) return;

  // TTL check — reject stale messages.
  const age = Date.now() - siteMessage.timestamp;
  if (age > MESSAGE_TTL_MS || age < -MESSAGE_TTL_MS) return;

  // Nonce anti-replay — reject duplicates.
  if (hasSeenNonce(siteMessage.requestId)) return;
  recordNonce(siteMessage.requestId);

  const { requestId, type } = siteMessage;
  const origin = event.origin;

  // This response type is handled by relay waiters in handleBackgroundRelay.
  if (type === "WEB_AUTH_BRIDGE_CODE") {
    return;
  }

  // Legacy OPEN_TRAIL_PANEL — keep backward compat with existing handler.
  if (type === "OPEN_TRAIL_PANEL") {
    sendMessage(rpc.openPanel())
      .then((response) => {
        postExtensionMessage(
          {
            type: "OPEN_TRAIL_PANEL_ACK",
            requestId,
            ok: response.success,
            error: response.success ? undefined : response.error,
          },
          origin,
        );
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : String(error);
        postExtensionMessage(
          { type: "OPEN_TRAIL_PANEL_ACK", requestId, ok: false, error: message },
          origin,
        );
      });
    return;
  }

  // All other messages — forward to background and relay ACK back.
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(siteMessage)) {
    if (key === "source" || key === "type" || key === "requestId" || key === "timestamp") continue;
    payload[key] = value;
  }

  sendMessage(rpc.siteMessageForward(type, payload, requestId))
    .then((response) => {
      if (response.success && response.data?.responsePayload) {
        postExtensionMessage(
          { ...response.data.responsePayload, requestId },
          origin,
        );
      }
    })
    .catch((error) => {
      if (shouldIgnoreRuntimeError(error)) return;
      console.debug("Failed to forward site message:", type, error);
    });
}

// ---------------------------------------------------------------------------
// Background → Content script → Site relay
// ---------------------------------------------------------------------------

function handleBackgroundRelay(): void {
  if (!chrome?.runtime?.onMessage) return;

  chrome.runtime.onMessage.addListener(
    (
      message: {
        type: string;
        payload?: unknown;
        expectResponseType?: unknown;
        timeoutMs?: unknown;
        [key: string]: unknown;
      },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => {
      // Only handle relay messages from background → site.
      if (message.type !== "RELAY_TO_SITE") return false;

      const payload = message.payload as Record<string, unknown> | undefined;
      if (!payload) return false;

      const targetOrigin = window.location.origin;
      if (!isAllowedSiteOrigin(targetOrigin)) {
        sendResponse({ success: false, error: "origin_not_allowed" });
        return false;
      }

      const expectedType =
        typeof message.expectResponseType === "string"
          ? message.expectResponseType
          : null;
      const timeoutMs =
        typeof message.timeoutMs === "number" && Number.isFinite(message.timeoutMs)
          ? Math.max(250, Math.floor(message.timeoutMs))
          : 1500;

      if (!expectedType) {
        postExtensionMessage(payload, targetOrigin);
        sendResponse({ success: true });
        return false;
      }

      const relayRequestId =
        typeof payload.requestId === "string" ? payload.requestId : null;
      if (!relayRequestId) {
        sendResponse({ success: false, error: "missing_request_id" });
        return false;
      }

      let done = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const finish = (response: unknown) => {
        if (done) return;
        done = true;
        window.removeEventListener("message", onSiteResponse);
        if (timer) {
          clearTimeout(timer);
        }
        sendResponse(response);
      };

      const onSiteResponse = (event: MessageEvent) => {
        if (event.source !== window) return;
        if (event.origin !== targetOrigin) return;

        const siteMessage = validateSiteMessage(event.data);
        if (!siteMessage) return;
        const age = Date.now() - siteMessage.timestamp;
        if (age > MESSAGE_TTL_MS || age < -MESSAGE_TTL_MS) return;
        if (siteMessage.type !== expectedType) return;
        if (siteMessage.requestId !== relayRequestId) return;

        finish({
          success: true,
          data: {
            responsePayload: siteMessage,
          },
        });
      };

      window.addEventListener("message", onSiteResponse);
      timer = setTimeout(() => {
        finish({ success: false, error: "relay_timeout" });
      }, timeoutMs);

      postExtensionMessage(payload, targetOrigin);
      return true;
    },
  );
}

// ---------------------------------------------------------------------------
// Title + Favicon observation (unchanged logic)
// ---------------------------------------------------------------------------

(function () {
  "use strict";

  // Register postMessage listener with security layer.
  window.addEventListener("message", handleSiteMessage);

  // Register relay from background → site.
  handleBackgroundRelay();

  let lastTitle = document.title;

  function handleTitleChange() {
    const title = document.title as Title;
    if (title && title !== lastTitle) {
      lastTitle = title;
      const url = window.location.href as Url;
      notifyTitleOrFaviconChange({ url, title });
    }
  }

  function getFaviconUrl(): FaviconUrl | undefined {
    const faviconElement =
      document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (faviconElement && faviconElement.href) {
      return faviconElement.href as FaviconUrl;
    }
    return undefined;
  }

  function handleFaviconChange() {
    const favicon = getFaviconUrl();
    if (favicon && favicon !== lastFavicon) {
      lastFavicon = favicon;
      const url = window.location.href as Url;
      notifyTitleOrFaviconChange({ url, favicon });
    }
  }

  // Observe title element changes
  const titleElement = document.querySelector("title");
  if (titleElement) {
    const titleObserver = new MutationObserver(handleTitleChange);
    titleObserver.observe(titleElement, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  // Watch for favicon changes
  let lastFavicon: FaviconUrl | undefined = getFaviconUrl();

  // Observe <head> for changes to favicon links
  const headElement = document.querySelector("head");
  if (headElement) {
    const faviconObserver = new MutationObserver(handleFaviconChange);
    faviconObserver.observe(headElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "rel"],
    });
  }

  const faviconCheckInterval = setInterval(handleFaviconChange, 2000);
  const titleCheckInterval = setInterval(handleTitleChange, 2000);

  setTimeout(() => {
    clearInterval(faviconCheckInterval);
    clearInterval(titleCheckInterval);
  }, 30000);

  console.debug("trail content script loaded");
})();
