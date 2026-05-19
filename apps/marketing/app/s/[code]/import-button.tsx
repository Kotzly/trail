"use client";

import { useCallback, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { INSTALL_URL } from "@/lib/install-url";

const BRIDGE_NAMESPACE = "trail-bridge-v1";
const IMPORT_MESSAGE = "site/import-shared-trail";
const PING_MESSAGE = "site/ping";
const REQUEST_KEY = "REQUEST";
const RESPONSE_KEY = "RESPONSE";
const TIMEOUT_MS = 3500;

type ImportResult =
  | { ok: true; trailId: string; label: string; nodeCount: number }
  | {
      ok: false;
      error:
        | "needs-signin"
        | "share-unavailable"
        | "share-self-import"
        | "share-no-device"
        | "unknown";
      message?: string;
    };

type PingResult = {
  version: string;
  authenticated: boolean;
  capabilities: string[];
};

type BridgeReply<T> = {
  type: string;
  message: T;
};

/**
 * "Import to my Trail" button on /s/<code>. Uses the existing
 * `trail-bridge-v1` window-postMessage namespace to talk to the
 * extension's content-script bridge — the same namespace already used
 * for `site/ping` and `site/open-panel`. No `externally_connectable`,
 * no hardcoded extension id in the marketing build.
 *
 * Falls back gracefully when:
 *   * The extension isn't installed (no PING reply within timeout).
 *   * The extension is installed but pre-share-import (no
 *     `share_import` capability in PING reply).
 *   * The user is signed-out (extension returns `needs-signin`; UI
 *     copy explains the sidepanel will open and complete the import
 *     after sign-in).
 */
export function ImportTrailButton({ code }: { code: string }) {
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "importing" }
    | { kind: "imported"; label: string }
    | { kind: "needs-signin" }
    | { kind: "no-extension" }
    | { kind: "self" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const handleClick = useCallback(async () => {
    setStatus({ kind: "checking" });
    const ping = await sendBridgeMessage<PingResult>(PING_MESSAGE);
    if (!ping || !ping.capabilities?.includes("share_import")) {
      setStatus({ kind: "no-extension" });
      return;
    }

    setStatus({ kind: "importing" });
    const result = await sendBridgeMessage<ImportResult>(IMPORT_MESSAGE, {
      code,
    });
    if (!result) {
      setStatus({
        kind: "error",
        message: "The extension didn't respond. Try again.",
      });
      return;
    }
    if (result.ok) {
      setStatus({ kind: "imported", label: result.label });
      return;
    }
    switch (result.error) {
      case "needs-signin":
        setStatus({ kind: "needs-signin" });
        break;
      case "share-self-import":
        setStatus({ kind: "self" });
        break;
      case "share-unavailable":
        setStatus({
          kind: "error",
          message:
            "This trail isn't available anymore. The owner may have revoked the link.",
        });
        break;
      case "share-no-device":
        setStatus({
          kind: "error",
          message:
            "Open the Trail extension first so we know where to import to.",
        });
        break;
      default:
        setStatus({
          kind: "error",
          message: result.message ?? "Import failed. Try again.",
        });
    }
  }, [code]);

  if (status.kind === "imported") {
    return (
      <div className="flex flex-col gap-1 rounded-md border bg-muted/30 p-3 text-sm">
        <strong className="font-medium">Imported into your Trail</strong>
        <span className="text-xs text-muted-foreground">
          &ldquo;{status.label}&rdquo; is now in your trail list.
        </span>
      </div>
    );
  }

  if (status.kind === "needs-signin") {
    return (
      <div className="flex flex-col gap-1 rounded-md border bg-muted/30 p-3 text-sm">
        <strong className="font-medium">Sign in to your Trail extension</strong>
        <span className="text-xs text-muted-foreground">
          We&apos;ve queued the import — finish signing in inside the extension
          and your trail will appear automatically.
        </span>
      </div>
    );
  }

  if (status.kind === "self") {
    return (
      <p className="text-sm text-muted-foreground">
        You can&apos;t import your own shared trail.
      </p>
    );
  }

  if (status.kind === "no-extension") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Install the Trail extension to import this trail in one click.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={INSTALL_URL} target="_blank" rel="noopener noreferrer">
              Install Trail
            </a>
          </Button>
          <Button variant="ghost" onClick={() => setStatus({ kind: "idle" })}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-destructive">{status.message}</p>
        <Button variant="outline" onClick={() => setStatus({ kind: "idle" })}>
          Try again
        </Button>
      </div>
    );
  }

  const busy = status.kind === "checking" || status.kind === "importing";
  return (
    <Button onClick={() => void handleClick()} disabled={busy}>
      {status.kind === "importing"
        ? "Importing..."
        : status.kind === "checking"
          ? "Looking for Trail..."
          : "Import to my Trail"}
    </Button>
  );
}

/**
 * Send a `trail-bridge-v1` postMessage and wait for the reply. The
 * `@webext-core/messaging` window protocol wraps messages with a `type`
 * (the namespace) and an inner envelope; the content script listens on
 * `message` events filtered by namespace and replies in kind. Mirror
 * that envelope here without taking a hard dependency on the package.
 */
async function sendBridgeMessage<T>(
  messageType: string,
  payload?: unknown,
): Promise<T | null> {
  if (typeof window === "undefined") return null;
  return new Promise<T | null>((resolve) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const requestEnvelope = {
      type: BRIDGE_NAMESPACE,
      message: {
        id,
        type: messageType,
        data: payload ?? undefined,
        timestamp: Date.now(),
      },
      _direction: REQUEST_KEY,
    };
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(null);
    }, TIMEOUT_MS);
    function handler(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data as unknown;
      if (!isReplyEnvelope(data, id)) return;
      window.removeEventListener("message", handler);
      clearTimeout(timer);
      const reply = (data as BridgeReply<{ data?: T }>)?.message?.data;
      resolve((reply ?? null) as T | null);
    }
    window.addEventListener("message", handler);
    window.postMessage(requestEnvelope, window.location.origin);
  });
}

function isReplyEnvelope(data: unknown, expectedId: string): boolean {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  if (obj.type !== BRIDGE_NAMESPACE) return false;
  if (obj._direction !== RESPONSE_KEY) return false;
  const msg = obj.message as Record<string, unknown> | undefined;
  return Boolean(msg && msg.id === expectedId);
}
