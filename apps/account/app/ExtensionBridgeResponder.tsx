"use client";

import { useEffect } from "react";
import {
  TRAIL_EXTENSION_SOURCE,
  TRAIL_SITE_SOURCE,
  type ExtensionWebBridgeCodeRequest,
  type SiteWebBridgeCodeResponse,
} from "@/src/lib/trail-extension";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function parseRequest(value: unknown): ExtensionWebBridgeCodeRequest | null {
  if (!isRecord(value)) {
    return null;
  }
  if (value.source !== TRAIL_EXTENSION_SOURCE) {
    return null;
  }
  if (value.type !== "REQUEST_WEB_AUTH_BRIDGE_CODE") {
    return null;
  }
  if (!isUuid(value.requestId)) {
    return null;
  }
  if (typeof value.timestamp !== "number" || !Number.isFinite(value.timestamp)) {
    return null;
  }

  return {
    source: TRAIL_EXTENSION_SOURCE,
    type: "REQUEST_WEB_AUTH_BRIDGE_CODE",
    requestId: value.requestId,
    timestamp: value.timestamp,
  };
}

async function buildResponse(
  requestId: string,
): Promise<SiteWebBridgeCodeResponse> {
  const response = await fetch("/api/v1/auth/bridge/web", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  }).catch(() => null);

  if (!response || !response.ok) {
    return {
      source: TRAIL_SITE_SOURCE,
      type: "WEB_AUTH_BRIDGE_CODE",
      requestId,
      timestamp: Date.now(),
      ok: false,
      error: response?.status === 401 ? "unauthorized" : "bridge_failed",
    };
  }

  const payload = (await response.json().catch(() => null)) as
    | { code?: unknown; expiresAt?: unknown }
    | null;

  const code = typeof payload?.code === "string" ? payload.code.trim() : "";
  const expiresAt =
    typeof payload?.expiresAt === "string" ? payload.expiresAt.trim() : "";

  if (!code || !expiresAt) {
    return {
      source: TRAIL_SITE_SOURCE,
      type: "WEB_AUTH_BRIDGE_CODE",
      requestId,
      timestamp: Date.now(),
      ok: false,
      error: "invalid_bridge_payload",
    };
  }

  return {
    source: TRAIL_SITE_SOURCE,
    type: "WEB_AUTH_BRIDGE_CODE",
    requestId,
    timestamp: Date.now(),
    ok: true,
    code,
    expiresAt,
  };
}

export default function ExtensionBridgeResponder() {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }
      if (event.origin !== window.location.origin) {
        return;
      }

      const request = parseRequest(event.data);
      if (!request) {
        return;
      }

      void buildResponse(request.requestId).then((payload) => {
        window.postMessage(payload, window.location.origin);
      });
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
