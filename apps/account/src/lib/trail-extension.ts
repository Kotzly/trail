/**
 * Trail extension postMessage bridge for the account site.
 *
 * Sends messages from the site to the extension content script via
 * window.postMessage and listens for ACK responses.
 *
 * Security: every message includes a UUID requestId and ms-precision
 * timestamp so the content script can enforce TTL and nonce checks.
 */

// ---------------------------------------------------------------------------
// Constants (must match extension/src/content/content-script.ts)
// ---------------------------------------------------------------------------

const SITE_SOURCE = "trail-site" as const;
const EXTENSION_SOURCE = "trail-extension" as const;
export const TRAIL_SITE_SOURCE = SITE_SOURCE;
export const TRAIL_EXTENSION_SOURCE = EXTENSION_SOURCE;

/** Retry backoffs (ms) for ACK-required messages: 1s, 2s, 4s */
const RETRY_BACKOFFS = [1_000, 2_000, 4_000] as const;

/** Default timeout waiting for an ACK (ms). */
const DEFAULT_ACK_TIMEOUT_MS = 3_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SiteMessageType =
  | "PING"
  | "OPEN_TRAIL_PANEL"
  | "ENTER_EDITOR_MODE"
  | "EXIT_EDITOR_MODE"
  | "SAVE_EDITOR_MODE"
  | "CANCEL_EDITOR_MODE"
  | "REQUEST_AUTH_BRIDGE_CODE"
  | "AUTH_REVOKED";

export type ExtensionMessageType =
  | "PONG"
  | "OPEN_TRAIL_PANEL_ACK"
  | "EDITOR_MODE_ENTERED"
  | "EDITOR_MODE_EXITED"
  | "EDITOR_MODE_SAVED"
  | "EDITOR_MODE_CANCELLED"
  | "TREE_UPDATED";

export type PongPayload = {
  version: string;
  authenticated: boolean;
  editorMode: boolean;
};

export type EditorModeEnteredPayload = {
  treeId: string;
  treeState: unknown;
};

export type EditorModeActionAck = {
  ok: boolean;
  error?: string;
};

export type AuthBridgeCodeAck = {
  code?: string;
  expiresAt?: string;
  error?: string;
};

export type ExtensionWebBridgeCodeRequest = {
  source: typeof TRAIL_EXTENSION_SOURCE;
  type: "REQUEST_WEB_AUTH_BRIDGE_CODE";
  requestId: string;
  timestamp: number;
};

export type SiteWebBridgeCodeResponse = {
  source: typeof TRAIL_SITE_SOURCE;
  type: "WEB_AUTH_BRIDGE_CODE";
  requestId: string;
  timestamp: number;
  ok: boolean;
  code?: string;
  expiresAt?: string;
  error?: string;
};

export type SendResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildMessage(
  type: SiteMessageType,
  payload: Record<string, unknown> = {},
) {
  return {
    source: SITE_SOURCE,
    type,
    requestId: createRequestId(),
    timestamp: Date.now(),
    ...payload,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Core send-and-wait
// ---------------------------------------------------------------------------

/**
 * Send a message and wait for an ACK response from the extension.
 * Returns the ACK payload or an error.
 */
function sendAndWaitForAck<T extends Record<string, unknown>>(
  type: SiteMessageType,
  payload: Record<string, unknown>,
  expectedAckType: string,
  timeoutMs = DEFAULT_ACK_TIMEOUT_MS,
): Promise<SendResult<T>> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, error: "Not in browser" });
  }

  const message = buildMessage(type, payload);
  const { requestId } = message;

  return new Promise((resolve) => {
    let finished = false;

    const finish = (result: SendResult<T>) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.source !== EXTENSION_SOURCE) return;
      if (data.type !== expectedAckType) return;
      if (data.requestId !== requestId) return;
      finish({ ok: true, data: data as T });
    };

    const timer = setTimeout(() => {
      finish({ ok: false, error: "timeout" });
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    window.postMessage(message, window.location.origin);
  });
}

/**
 * Send with automatic retry on timeout (ACK-required messages).
 * Uses backoffs defined in RETRY_BACKOFFS.
 */
async function sendWithRetry<T extends Record<string, unknown>>(
  type: SiteMessageType,
  payload: Record<string, unknown>,
  expectedAckType: string,
  ackTimeoutMs = DEFAULT_ACK_TIMEOUT_MS,
): Promise<SendResult<T>> {
  // First attempt
  let result = await sendAndWaitForAck<T>(
    type,
    payload,
    expectedAckType,
    ackTimeoutMs,
  );
  if (result.ok) return result;

  // Retries
  for (const backoff of RETRY_BACKOFFS) {
    await sleep(backoff);
    result = await sendAndWaitForAck<T>(
      type,
      payload,
      expectedAckType,
      ackTimeoutMs,
    );
    if (result.ok) return result;
  }

  return {
    ok: false,
    error:
      "Extension not responding. Try reopening the side panel.",
  };
}

function parseEditorModeActionResult(
  result: SendResult<EditorModeActionAck & Record<string, unknown>>,
  defaultError: string,
): SendResult<EditorModeActionAck> {
  if (!result.ok) {
    return result;
  }

  const data = result.data as Record<string, unknown>;
  if (data.ok !== true && data.ok !== false) {
    return { ok: false, error: defaultError };
  }

  if (!data.ok) {
    return {
      ok: false,
      error:
        typeof data.error === "string" && data.error.trim().length > 0
          ? data.error
          : defaultError,
    };
  }

  return { ok: true, data: { ok: true } };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Ping the extension to check presence and auth state. */
export async function ping(): Promise<SendResult<PongPayload>> {
  // Для ping нам не нужны долгие ретраи — хотим быстро понять, установлен ли
  // вообще контент-скрипт/расширение. Используем один короткий запрос.
  const result = await sendAndWaitForAck<PongPayload & Record<string, unknown>>(
    "PING",
    {},
    "PONG",
    700,
  );
  return result as SendResult<PongPayload>;
}

/** Request the extension to open its side panel. */
export function openTrailPanel(): Promise<
  SendResult<{ ok: boolean; error?: string }>
> {
  return sendWithRetry("OPEN_TRAIL_PANEL", {}, "OPEN_TRAIL_PANEL_ACK");
}

export async function requestAuthBridgeCode(): Promise<
  SendResult<{ code: string; expiresAt: string }>
> {
  const result = await sendWithRetry<AuthBridgeCodeAck & Record<string, unknown>>(
    "REQUEST_AUTH_BRIDGE_CODE",
    {},
    "AUTH_BRIDGE_CODE",
    1_500,
  );

  if (!result.ok) {
    return result;
  }

  const code =
    typeof result.data.code === "string" ? result.data.code.trim() : "";
  const expiresAt =
    typeof result.data.expiresAt === "string"
      ? result.data.expiresAt.trim()
      : "";
  if (!code || !expiresAt) {
    const error =
      typeof result.data.error === "string" && result.data.error.trim().length > 0
        ? result.data.error
        : "Missing bridge code";
    return { ok: false, error };
  }

  return { ok: true, data: { code, expiresAt } };
}

export async function notifyAuthRevoked(): Promise<SendResult<Record<string, unknown>>> {
  return sendWithRetry("AUTH_REVOKED", {}, "AUTH_REVOKED_ACK", 1_500);
}

/**
 * Ensure the extension side panel is open before sending a command that
 * requires it.  Silently ignores errors (panel may already be open).
 */
async function ensurePanelOpen(): Promise<void> {
  await openTrailPanel().catch(() => {});
}

/** Tell the extension to enter editor mode for a specific tree. */
export async function enterEditorMode(
  treeId: string,
): Promise<SendResult<EditorModeEnteredPayload>> {
  await ensurePanelOpen();

  const result = await sendWithRetry<
    EditorModeEnteredPayload & Record<string, unknown>
  >("ENTER_EDITOR_MODE", { treeId }, "EDITOR_MODE_ENTERED");

  if (!result.ok) {
    return result;
  }

  const data = result.data as Record<string, unknown>;
  if (typeof data.error === "string") {
    return { ok: false, error: data.error };
  }

  return { ok: true, data: result.data as EditorModeEnteredPayload };
}

/**
 * @deprecated Prefer `saveEditorMode` or `cancelEditorMode`.
 * Kept for backwards compatibility with older UI flows.
 */
export function exitEditorMode(): Promise<SendResult<Record<string, unknown>>> {
  return sendWithRetry(
    "EXIT_EDITOR_MODE",
    {},
    "EDITOR_MODE_EXITED",
  );
}

/** Save the current editor session and exit editor mode on success. */
export async function saveEditorMode(): Promise<SendResult<EditorModeActionAck>> {
  const result = await sendWithRetry<EditorModeActionAck & Record<string, unknown>>(
    "SAVE_EDITOR_MODE",
    {},
    "EDITOR_MODE_SAVED",
  );
  return parseEditorModeActionResult(result, "Failed to save editor session");
}

/** Cancel the current editor session and rollback to session snapshot. */
export async function cancelEditorMode(): Promise<SendResult<EditorModeActionAck>> {
  const result = await sendWithRetry<EditorModeActionAck & Record<string, unknown>>(
    "CANCEL_EDITOR_MODE",
    {},
    "EDITOR_MODE_CANCELLED",
  );
  return parseEditorModeActionResult(result, "Failed to cancel editor session");
}

// ---------------------------------------------------------------------------
// Inbound listener: extension → site
// ---------------------------------------------------------------------------

export type ExtensionEvent =
  | { type: "NODE_SELECTED"; nodeId: string; nodeData: unknown }
  | { type: "TREE_UPDATED"; treeId: string; patch: unknown }
  | { type: "EDITOR_MODE_EXITED" }
  | { type: "AUTH_REVOKED" };

type ExtensionEventListener = (event: ExtensionEvent) => void;

const listeners = new Set<ExtensionEventListener>();

function handleExtensionMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.source !== EXTENSION_SOURCE) return;

  let parsed: ExtensionEvent | null = null;

  switch (data.type) {
    case "NODE_SELECTED":
      if (typeof data.nodeId === "string") {
        parsed = {
          type: "NODE_SELECTED",
          nodeId: data.nodeId,
          nodeData: data.nodeData,
        };
      }
      break;
    case "TREE_UPDATED":
      if (typeof data.treeId === "string") {
        parsed = {
          type: "TREE_UPDATED",
          treeId: data.treeId,
          patch: data.patch,
        };
      }
      break;
    case "EDITOR_MODE_EXITED":
      parsed = { type: "EDITOR_MODE_EXITED" };
      break;
    case "AUTH_REVOKED":
      parsed = { type: "AUTH_REVOKED" };
      break;
  }

  if (!parsed) return;
  for (const listener of listeners) {
    try {
      listener(parsed);
    } catch (e) {
      console.error("[trail-extension] listener error:", e);
    }
  }
}

/** Subscribe to events pushed by the extension. Returns unsubscribe fn. */
export function onExtensionEvent(
  listener: ExtensionEventListener,
): () => void {
  if (listeners.size === 0 && typeof window !== "undefined") {
    window.addEventListener("message", handleExtensionMessage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("message", handleExtensionMessage);
    }
  };
}
