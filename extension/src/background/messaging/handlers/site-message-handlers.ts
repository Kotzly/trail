/**
 * Handlers for site → extension messages forwarded by the content script.
 *
 * The content script validates, applies TTL/nonce/origin checks, then sends
 * a SITE_MESSAGE_FORWARD message here. This handler dispatches based on the
 * inner `siteMessageType`.
 */
import {
  MSG,
  type SiteMessageForwardResponse,
  type ResponseMessage,
  ok,
  err,
} from "../../../shared/types/messages.js";
import { defineHandlers } from "../../../shared/types/messages.js";
import type { SiteMessageForwardMessage } from "../../../shared/types/messages.js";

// ---------------------------------------------------------------------------
// Auth state helpers (reads from chrome.storage, same key as cloud-sync)
// ---------------------------------------------------------------------------

const AUTH_STORAGE_KEY = "trail_auth_session";

type StoredAuthSession = {
  accessToken?: string;
};

async function isAuthenticated(): Promise<boolean> {
  try {
    const data = await chrome.storage.local.get(AUTH_STORAGE_KEY);
    const session = data[AUTH_STORAGE_KEY] as StoredAuthSession | undefined;
    return Boolean(session?.accessToken);
  } catch {
    return false;
  }
}

async function clearAuthSession(): Promise<void> {
  try {
    await chrome.storage.local.remove(AUTH_STORAGE_KEY);
  } catch (e) {
    console.error("[site-message] failed to clear auth session:", e);
  }
}

// ---------------------------------------------------------------------------
// Inner dispatch: site message type → response payload
// ---------------------------------------------------------------------------

type InnerHandler = (
  payload: Record<string, unknown>,
  requestId: string,
) => Promise<SiteMessageForwardResponse> | SiteMessageForwardResponse;

const innerHandlers: Record<string, InnerHandler> = {
  /**
   * PING — returns PONG with extension state.
   * Used by the site to check if extension is present and authenticated.
   */
  PING: async (_payload, _requestId) => {
    const authed = await isAuthenticated();
    return {
      responsePayload: {
        source: "trail-extension",
        type: "PONG",
        version: chrome.runtime.getManifest().version,
        authenticated: authed,
        editorMode: false, // TODO(phase3): read from editor mode store
      },
    };
  },

  /**
   * AUTH_REVOKED — site logout propagation.
   * Extension should clear tokens and show auth gate.
   */
  AUTH_REVOKED: async (_payload, _requestId) => {
    console.debug("[site-message] AUTH_REVOKED received — clearing tokens");
    await clearAuthSession();
    return {};
  },
};

// ---------------------------------------------------------------------------
// Exported handler map
// ---------------------------------------------------------------------------

export const siteMessageHandlers = defineHandlers({
  [MSG.SITE_MESSAGE_FORWARD]: async (
    message: SiteMessageForwardMessage,
  ): Promise<ResponseMessage<typeof MSG.SITE_MESSAGE_FORWARD>> => {
    const { siteMessageType, payload, requestId } = message;
    const handler = innerHandlers[siteMessageType];

    if (!handler) {
      // Phase 3–4 message types are not yet implemented.
      return err(`Site message type not yet handled: ${siteMessageType}`);
    }

    try {
      const result = await handler(payload, requestId);
      return ok(result);
    } catch (e) {
      console.error("[site-message] handler error:", siteMessageType, e);
      return err(e instanceof Error ? e.message : "Unknown error");
    }
  },
});
