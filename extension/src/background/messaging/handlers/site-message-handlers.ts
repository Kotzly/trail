/**
 * Handlers for site → extension messages forwarded by the content script.
 *
 * The content script validates, applies TTL/nonce/origin checks, then sends
 * a SITE_MESSAGE_FORWARD message here. This handler dispatches based on the
 * inner `siteMessageType`.
 */
import {
  RPC_METHOD,
  defineRpcHandlers,
  type SiteMessageForwardResponse,
  type ResponseMessage,
  type SiteMessageForwardMessage,
  ok,
  err,
} from "../../../shared/rpc/contracts.js";
import {
  getEditorState,
  enterEditorMode,
  saveEditorMode,
  cancelEditorMode,
} from "./editor-handlers.js";
import { authOrchestrator } from "../../services/auth-orchestrator.js";
import { authSessionItem } from "@shared/config/storage-items.js";
import { browser } from "@shared/platform/webext.js";
import { createLogger } from "@shared/lib/logger.js";
import {
  EnterEditorModeMessage as EnterEditorSchema,
  AuthCodeRelayMessage as AuthCodeRelaySchema,
} from "../../../shared/schemas/site-messages.js";
import type { z } from "zod";

const log = createLogger("site-msg");

// ---------------------------------------------------------------------------
// Payload validation schemas (only for message types with typed fields)
// ---------------------------------------------------------------------------

const payloadSchemas: Partial<Record<string, z.ZodType>> = {
  ENTER_EDITOR_MODE: EnterEditorSchema,
  AUTH_CODE_RELAY: AuthCodeRelaySchema,
};

// ---------------------------------------------------------------------------
// Auth state helpers
// ---------------------------------------------------------------------------

async function isAuthenticated(): Promise<boolean> {
  try {
    const session = await authSessionItem.getValue();
    return Boolean(session?.accessToken);
  } catch {
    return false;
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
        version: browser.runtime.getManifest().version,
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
    // AUTH_REVOKED received — clearing tokens
    await authOrchestrator.invalidateFromWebLogout();
    return {
      responsePayload: {
        source: "trail-extension",
        type: "AUTH_REVOKED_ACK",
        ok: true,
      },
    };
  },

  ENTER_EDITOR_MODE: async (payload, _requestId) => {
    const treeId = payload.treeId as string;
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

  AUTH_CODE_RELAY: async (payload, _requestId) => {
    const { code, codeVerifier, redirectUri } = payload as {
      code: string;
      codeVerifier: string;
      redirectUri: string;
    };

    if (!code || !codeVerifier || !redirectUri) {
      return {
        responsePayload: {
          source: "trail-extension",
          type: "AUTH_CODE_RELAY_ACK",
          ok: false,
          error: "Missing code, codeVerifier, or redirectUri",
        },
      };
    }

    const result = await authOrchestrator.handleAuthCodeRelay({
      code,
      codeVerifier,
      redirectUri,
    });

    return {
      responsePayload: {
        source: "trail-extension",
        type: "AUTH_CODE_RELAY_ACK",
        ok: result.ok,
        error: result.ok ? undefined : result.reason,
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

    // Validate payload for types with typed fields
    const schema = payloadSchemas[siteMessageType];
    if (schema) {
      const fullMessage = {
        source: "trail-site" as const,
        type: siteMessageType,
        requestId,
        timestamp: Date.now(),
        ...payload,
      };
      const parsed = schema.safeParse(fullMessage);
      if (!parsed.success) {
        log.warn("Payload validation failed", {
          type: siteMessageType,
          issues: parsed.error.issues,
        });
        return err(
          `Invalid payload for ${siteMessageType}: ${parsed.error.issues[0]?.message ?? "unknown"}`,
        );
      }
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
