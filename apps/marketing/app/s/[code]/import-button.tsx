"use client";

import { useCallback, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { INSTALL_URL } from "@/lib/install-url";
import { sendBridgeMessage } from "@/lib/bridge/messaging";
import {
  WEBSITE_MESSAGE,
  type ImportSharedTrailReply,
  type WebsitePingReply,
} from "@/lib/bridge/protocol";

const PING_TIMEOUT_MS = 1500;
const IMPORT_TIMEOUT_MS = 8000;

/**
 * "Import to my Trail" button on /s/<code>. Talks to the extension
 * content script via the `trail-bridge-v1` window-postMessage protocol
 * (see `extension/src/content/bridge/`). Both sides use
 * `@webext-core/messaging`'s window transport so the envelope shape
 * stays in sync; a previous hand-rolled wrapper sent the wrong `type`
 * field and silently dropped every reply, which is why "Install Trail"
 * showed for users who already had the extension.
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
    const ping = await pingExtension();
    if (!ping || !ping.capabilities?.includes("share_import")) {
      setStatus({ kind: "no-extension" });
      return;
    }

    setStatus({ kind: "importing" });
    const result = await importViaExtension(code);
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
 * `sendBridgeMessage` resolves only when the content-script replies —
 * with no extension installed it never resolves. Both calls below race
 * the messaging promise against a timeout so the UI can fall through to
 * the install CTA / error surface.
 */
function pingExtension(): Promise<WebsitePingReply | null> {
  return raceWithTimeout(
    sendBridgeMessage(WEBSITE_MESSAGE.PING),
    PING_TIMEOUT_MS,
  );
}

function importViaExtension(
  code: string,
): Promise<ImportSharedTrailReply | null> {
  return raceWithTimeout(
    sendBridgeMessage(WEBSITE_MESSAGE.IMPORT_SHARED_TRAIL, { code }),
    IMPORT_TIMEOUT_MS,
  );
}

function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, timeoutMs);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}
