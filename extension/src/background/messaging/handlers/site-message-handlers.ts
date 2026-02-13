/**
 * Handlers for site → extension messages forwarded by the content script.
 *
 * The content script validates, applies TTL/nonce/origin checks, then sends
 * a SITE_MESSAGE_FORWARD message here. This handler dispatches based on the
 * inner `siteMessageType`.
 */
import {
  RPC_METHOD,
  rpc,
  type SiteMessageForwardResponse,
  type ResponseMessage,
  ok,
  err,
} from "../../../shared/rpc/contracts.js";
import { defineRpcHandlers } from "../../../shared/rpc/contracts.js";
import type { SiteMessageForwardMessage } from "../../../shared/rpc/contracts.js";
import {
  getEditorState,
  enterEditorMode,
  saveEditorMode,
  cancelEditorMode,
} from "./editor-handlers.js";

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
    const editor = getEditorState();
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
    const result = await saveEditorMode();
    if (!result.ok) {
      return {
        responsePayload: {
          source: "trail-extension",
          type: "EDITOR_MODE_EXITED",
          ok: false,
          error: result.error,
          editorMode: true,
        },
      };
    }
    return {
      responsePayload: {
        source: "trail-extension",
        type: "EDITOR_MODE_EXITED",
        ok: true,
        editorMode: false,
      },
    };
  },

  SAVE_EDITOR_MODE: async (_payload, _requestId) => {
    const result = await saveEditorMode();
    return {
      responsePayload: {
        source: "trail-extension",
        type: "EDITOR_MODE_SAVED",
        ok: result.ok,
        ...(result.ok ? {} : { error: result.error }),
      },
    };
  },

  CANCEL_EDITOR_MODE: async (_payload, _requestId) => {
    const result = await cancelEditorMode();
    return {
      responsePayload: {
        source: "trail-extension",
        type: "EDITOR_MODE_CANCELLED",
        ok: result.ok,
        ...(result.ok ? {} : { error: result.error }),
      },
    };
  },
};

// ---------------------------------------------------------------------------
// Exported handler map
// ---------------------------------------------------------------------------

export const siteMessageHandlers = defineRpcHandlers({
  [RPC_METHOD.SITE_MESSAGE_FORWARD]: async (
    message: SiteMessageForwardMessage,
  ): Promise<ResponseMessage<typeof RPC_METHOD.SITE_MESSAGE_FORWARD>> => {
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
