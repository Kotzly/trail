/**
 * Handlers for site → extension messages forwarded by the content script.
 *
 * The content script validates, applies TTL/nonce/origin checks, then sends
 * a SITE_MESSAGE_FORWARD message here. This handler dispatches based on the
 * inner `siteMessageType`.
 */
import {
  MSG,
  msg,
  type SiteMessageForwardResponse,
  type ResponseMessage,
  ok,
  err,
} from "../../../shared/types/messages.js";
import { defineHandlers } from "../../../shared/types/messages.js";
import type { SiteMessageForwardMessage } from "../../../shared/types/messages.js";
import { getEditorState, enterEditorMode, exitEditorMode } from "./editor-handlers.js";

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
    // #region agent log
    const _pt0 = Date.now();
    fetch('http://127.0.0.1:7243/ingest/937115ee-9cd6-4fc0-9921-cf0a6510eab8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'site-message-handlers.ts:PING',message:'PING handler invoked',timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    const authed = await isAuthenticated();
    const editor = getEditorState();
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/937115ee-9cd6-4fc0-9921-cf0a6510eab8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'site-message-handlers.ts:PING',message:'PING handler done',data:{authed,editorActive:editor.active,elapsed:Date.now()-_pt0},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    return {
      responsePayload: {
        source: "trail-extension",
        type: "PONG",
        version: chrome.runtime.getManifest().version,
        authenticated: authed,
        editorMode: editor.active,
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

  ENTER_EDITOR_MODE: async (payload, _requestId) => {
    // #region agent log
    const _et0 = Date.now();
    fetch('http://127.0.0.1:7243/ingest/937115ee-9cd6-4fc0-9921-cf0a6510eab8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'site-message-handlers.ts:ENTER_EDITOR_MODE',message:'handler invoked',data:{treeId:payload.treeId,requestId:_requestId},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    const treeId = typeof payload.treeId === "string" ? payload.treeId : "";
    if (!treeId) {
      return {
        responsePayload: {
          source: "trail-extension",
          type: "EDITOR_MODE_ENTERED",
          error: "Missing treeId",
        },
      };
    }

    const result = await enterEditorMode(treeId);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/937115ee-9cd6-4fc0-9921-cf0a6510eab8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'site-message-handlers.ts:ENTER_EDITOR_MODE',message:'handler done',data:{treeId,isError:typeof result==='string',result:typeof result==='string'?result:result.treeId,elapsed:Date.now()-_et0},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    if (typeof result === "string") {
      return {
        responsePayload: {
          source: "trail-extension",
          type: "EDITOR_MODE_ENTERED",
          error: result,
        },
      };
    }

    return {
      responsePayload: {
        source: "trail-extension",
        type: "EDITOR_MODE_ENTERED",
        treeId: result.treeId,
      },
    };
  },

  EXIT_EDITOR_MODE: async (_payload, _requestId) => {
    const result = await exitEditorMode();
    return {
      responsePayload: {
        source: "trail-extension",
        type: "EDITOR_MODE_EXITED",
        editorMode: result.active,
      },
    };
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
