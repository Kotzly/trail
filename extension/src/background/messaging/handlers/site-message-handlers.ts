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
  PING: (_payload, _requestId) => {
    // TODO(phase1): read real auth state and editor mode from stores
    return {
      responsePayload: {
        source: "trail-extension",
        type: "PONG",
        version: chrome.runtime.getManifest().version,
        authenticated: false,
        editorMode: false,
      },
    };
  },

  /**
   * AUTH_REVOKED — site logout propagation.
   * Extension should clear tokens and show auth gate.
   */
  AUTH_REVOKED: (_payload, _requestId) => {
    // TODO(phase1): clear stored tokens, trigger auth gate
    console.debug("[site-message] AUTH_REVOKED received — will clear tokens");
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
