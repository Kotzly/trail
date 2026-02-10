/**
 * Content script for Trail.
 *
 * Responsibilities:
 * 1. Track title / favicon changes and report to background.
 * 2. Bridge postMessage between the Trail account site and the extension
 *    background, enforcing the security layer (origin, schema, TTL, nonce).
 *
 * ⚠ No heavy dependencies here (no Zod, no large libs) — this script is
 * injected on every page the user visits.
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
  type: typeof MSG.TITLE_OR_FAVICON_CHANGED;
  url: Url;
  title?: Title;
  favicon?: FaviconUrl;
};

type OpenPanelMessage = {
  type: typeof MSG.OPEN_PANEL;
};

/** Messages forwarded from site → background via content script. */
type SiteForwardMessage = {
  type: typeof MSG.SITE_MESSAGE_FORWARD;
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
  [MSG.TITLE_OR_FAVICON_CHANGED]: void;
  [MSG.OPEN_PANEL]: void;
  [MSG.SITE_MESSAGE_FORWARD]: { responsePayload?: Record<string, unknown> };
};

type ResponseMessage<T extends RequestType> = MessageResponse<ResponseDataByType[T]>;

const MSG = {
  TITLE_OR_FAVICON_CHANGED: "TITLE_OR_FAVICON_CHANGED",
  OPEN_PANEL: "OPEN_PANEL",
  SITE_MESSAGE_FORWARD: "SITE_MESSAGE_FORWARD",
} as const;

const msgBuilder = {
  titleOrFaviconChanged(payload: {
    url: Url;
    title?: Title;
    favicon?: FaviconUrl;
  }): TitleOrFaviconChangedMessage {
    return { type: MSG.TITLE_OR_FAVICON_CHANGED, ...payload };
  },
  openPanel(): OpenPanelMessage {
    return { type: MSG.OPEN_PANEL };
  },
  siteMessageForward(
    siteMessageType: string,
    payload: Record<string, unknown>,
    requestId: string,
  ): SiteForwardMessage {
    return { type: MSG.SITE_MESSAGE_FORWARD, siteMessageType, payload, requestId };
  },
};

// ---------------------------------------------------------------------------
// Site ↔ Extension postMessage constants
// ---------------------------------------------------------------------------

const SITE_SOURCE = "trail-site" as const;
const EXTENSION_SOURCE = "trail-extension" as const;

/**
 * Strict origin whitelist.
 * No broad hostname fallback — only explicit entries.
 */
const ALLOWED_ORIGINS = new Set<string>([
  "https://gettrail.net",
  "https://app.gettrail.net",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
]);

/** Known site → extension message types. */
const KNOWN_SITE_TYPES = new Set<string>([
  "PING",
  "OPEN_TRAIL_PANEL",
  "ENTER_EDITOR_MODE",
  "EXIT_EDITOR_MODE",
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

function shouldIgnoreRuntimeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return IGNORED_ERROR_FRAGMENTS.some((fragment) =>
    message.includes(fragment),
  );
}

function sendMessage<T extends RequestType>(
  message: MessageByType<T>,
): Promise<ResponseMessage<T>> {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.id) {
      return reject(new Error("Extension context invalidated"));
    }
    try {
      chrome.runtime.sendMessage(message, (response: ResponseMessage<T>) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(err);
        resolve(response);
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
  fireAndForget(msgBuilder.titleOrFaviconChanged(payload));
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
  if (!ALLOWED_ORIGINS.has(event.origin)) return;

  // Lightweight structural validation.
  const msg = validateSiteMessage(event.data);
  if (!msg) return;

  // TTL check — reject stale messages.
  const age = Date.now() - msg.timestamp;
  if (age > MESSAGE_TTL_MS || age < -MESSAGE_TTL_MS) return;

  // Nonce anti-replay — reject duplicates.
  if (hasSeenNonce(msg.requestId)) return;
  recordNonce(msg.requestId);

  const { requestId, type } = msg;
  const origin = event.origin;

  // Legacy OPEN_TRAIL_PANEL — keep backward compat with existing handler.
  if (type === "OPEN_TRAIL_PANEL") {
    sendMessage(msgBuilder.openPanel())
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

  // AUTH_REVOKED — fire-and-forget, no ACK.
  if (type === "AUTH_REVOKED") {
    fireAndForget(
      msgBuilder.siteMessageForward("AUTH_REVOKED", {}, requestId),
    );
    return;
  }

  // All other messages — forward to background and relay ACK back.
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(msg)) {
    if (key === "source" || key === "type" || key === "requestId" || key === "timestamp") continue;
    payload[key] = value;
  }

  sendMessage(msgBuilder.siteMessageForward(type, payload, requestId))
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
      message: { type: string; [key: string]: unknown },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ) => {
      // Only handle relay messages from background → site.
      if (message.type !== "RELAY_TO_SITE") return false;

      const payload = message.payload as Record<string, unknown> | undefined;
      if (!payload) return false;

      postExtensionMessage(payload, window.location.origin);
      sendResponse({ success: true });
      return false;
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
