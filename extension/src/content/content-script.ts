/**
 * Content script for Trail.
 * Tracks title changes for pages that update title dynamically.
 */

type Brand<T, B extends string> = T & { readonly __brand: B };

type Url = Brand<string, "Url">;
type Title = Brand<string, "Title">;
type FaviconUrl = Brand<string, "FaviconUrl">;

type TitleOrFaviconChangedMessage = {
  type: typeof MSG.TITLE_OR_FAVICON_CHANGED;
  url: Url;
  title?: Title;
  favicon?: FaviconUrl;
};

type OpenPanelMessage = {
  type: typeof MSG.OPEN_PANEL;
};

type RequestMessage = TitleOrFaviconChangedMessage | OpenPanelMessage;

type RequestType = RequestMessage["type"];

type MessageByType<T extends RequestType> = Extract<RequestMessage, { type: T }>;

type Ok<T = void> = { success: true; data: T };

type Err = { success: false; error: string };

type MessageResponse<T = void> = Ok<T> | Err;

type ResponseDataByType = {
  [MSG.TITLE_OR_FAVICON_CHANGED]: void;
  [MSG.OPEN_PANEL]: void;
};

type ResponseMessage<T extends RequestType> = MessageResponse<ResponseDataByType[T]>;

const MSG = {
  TITLE_OR_FAVICON_CHANGED: "TITLE_OR_FAVICON_CHANGED",
  OPEN_PANEL: "OPEN_PANEL",
} as const;

const msg = {
  titleOrFaviconChanged(payload: { url: Url; title?: Title; favicon?: FaviconUrl }): TitleOrFaviconChangedMessage {
    return {
      type: MSG.TITLE_OR_FAVICON_CHANGED,
      ...payload,
    };
  },
  openPanel(): OpenPanelMessage {
    return { type: MSG.OPEN_PANEL };
  },
};

const SITE_MESSAGE_SOURCE = "trail-site" as const;
const EXTENSION_MESSAGE_SOURCE = "trail-extension" as const;
const OPEN_TRAIL_PANEL = "OPEN_TRAIL_PANEL" as const;
const OPEN_TRAIL_PANEL_ACK = "OPEN_TRAIL_PANEL_ACK" as const;

const ALLOWED_ORIGINS = new Set<string>([
  "https://gettrail.net",
  "https://app.gettrail.net",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
]);

type SiteOpenPanelMessage = {
  source: typeof SITE_MESSAGE_SOURCE;
  type: typeof OPEN_TRAIL_PANEL;
  requestId: string;
};

type ExtensionOpenPanelAck = {
  source: typeof EXTENSION_MESSAGE_SOURCE;
  type: typeof OPEN_TRAIL_PANEL_ACK;
  requestId: string;
  ok: boolean;
  error?: string;
};

const IGNORED_ERROR_FRAGMENTS = [
  "The message port closed before a response was received.",
  "Extension context invalidated",
  "Receiving end does not exist",
];

function shouldIgnoreRuntimeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return IGNORED_ERROR_FRAGMENTS.some((fragment) => message.includes(fragment));
}

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function sendMessage<T extends RequestType>(
  message: MessageByType<T>
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

function fireAndForget<T extends RequestType>(message: MessageByType<T>): void {
  sendMessage(message).catch((error) => {
    if (shouldIgnoreRuntimeError(error)) return;
    console.debug("Failed to send message:", message.type, error);
  });
}

function notifyTitleOrFaviconChange(payload: { url: Url; title?: Title; favicon?: FaviconUrl }): void {
  fireAndForget(msg.titleOrFaviconChanged(payload));
}

function postOpenPanelAck(requestId: string, origin: string, ok: boolean, error?: string): void {
  if (!requestId) return;
  const message: ExtensionOpenPanelAck = {
    source: EXTENSION_MESSAGE_SOURCE,
    type: OPEN_TRAIL_PANEL_ACK,
    requestId,
    ok,
  };
  if (error) message.error = error;
  window.postMessage(message, origin);
}

function handleOpenPanelRequest(event: MessageEvent): void {
  if (event.source !== window) return;
  if (!isAllowedOrigin(event.origin)) return;

  const data = event.data as Partial<SiteOpenPanelMessage> | null;
  if (!data || data.source !== SITE_MESSAGE_SOURCE || data.type !== OPEN_TRAIL_PANEL) return;

  const requestId = typeof data.requestId === "string" ? data.requestId : "";

  sendMessage(msg.openPanel())
    .then((response) => {
      postOpenPanelAck(requestId, event.origin, response.success, response.success ? undefined : response.error);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      postOpenPanelAck(requestId, event.origin, false, message);
    });
}

(function () {
  "use strict";

  window.addEventListener("message", handleOpenPanelRequest);

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
    const faviconElement = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
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
