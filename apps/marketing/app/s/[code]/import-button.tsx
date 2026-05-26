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
const OPEN_TIMEOUT_MS = 5000;

/**
 * "Import to my Trail" button on /s/<code>. Rather than importing directly,
 * it asks the extension to queue the share and open its side panel, where
 * the user reviews and confirms the import. That's safer and clearer than a
 * silent background import — and the page can't even tell whose trail it is
 * (the self-import check needs the signed-in identity the extension has).
 *
 * Talks to the content script via the `trail-bridge-v1` window-postMessage
 * protocol (see `extension/src/content/bridge/`). Both sides use
 * `@webext-core/messaging`'s window transport so the envelope stays in sync.
 */
export function ImportTrailButton({
  code,
  label,
  nodeCount,
}: {
  code: string;
  label?: string;
  nodeCount?: number;
}) {
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "opening" }
    | { kind: "opened" }
    | { kind: "no-extension" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const handleClick = useCallback(async () => {
    setStatus({ kind: "checking" });
    const ping = await pingExtension();
    if (!ping || !ping.capabilities?.includes("share_import")) {
      setStatus({ kind: "no-extension" });
      return;
    }

    setStatus({ kind: "opening" });
    const result = await requestImport({ code, label, nodeCount });
    if (!result) {
      setStatus({
        kind: "error",
        message: "The Trail extension didn't respond. Try again.",
      });
      return;
    }
    if (result.ok) {
      setStatus({ kind: "opened" });
      return;
    }
    setStatus({
      kind: "error",
      message: result.message ?? "Couldn't open Trail. Try again.",
    });
  }, [code, label, nodeCount]);

  if (status.kind === "opened") {
    return (
      <div className="flex flex-col gap-1 rounded-md border bg-muted/30 p-3 text-sm">
        <strong className="font-medium">Opened in the Trail extension</strong>
        <span className="text-xs text-muted-foreground">
          Review and confirm the import in the side panel. Nothing is added to
          your Trail until you approve it there.
        </span>
      </div>
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

  const busy = status.kind === "checking" || status.kind === "opening";
  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={() => void handleClick()}
        disabled={busy}
        className="w-fit"
      >
        {status.kind === "opening"
          ? "Opening Trail…"
          : status.kind === "checking"
            ? "Looking for Trail…"
            : "Import to my Trail"}
      </Button>
      <p className="max-w-prose text-xs text-muted-foreground">
        Opens the Trail extension to review and confirm — nothing is imported
        until you approve it in the side panel. The owner can revoke the link
        anytime; your imported copy is unaffected.
      </p>
    </div>
  );
}

function pingExtension(): Promise<WebsitePingReply | null> {
  return raceWithTimeout(
    sendBridgeMessage(WEBSITE_MESSAGE.PING),
    PING_TIMEOUT_MS,
  );
}

function requestImport(req: {
  code: string;
  label?: string;
  nodeCount?: number;
}): Promise<ImportSharedTrailReply | null> {
  return raceWithTimeout(
    sendBridgeMessage(WEBSITE_MESSAGE.IMPORT_SHARED_TRAIL, req),
    OPEN_TIMEOUT_MS,
  );
}

/**
 * `sendBridgeMessage` resolves only when the content-script replies — with
 * no extension installed it never resolves. Both calls above race the
 * messaging promise against a timeout so the UI can fall through to the
 * install CTA / error surface.
 */
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
