"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const SITE_SOURCE = "trail-site" as const;
const RELAY_TIMEOUT_MS = 5_000;

function ExtensionRelayInner() {
  const searchParams = useSearchParams();
  const sentRef = useRef(false);

  const code = searchParams.get("code");
  const codeVerifier = searchParams.get("codeVerifier");
  const redirectUri = searchParams.get("redirectUri");
  const next = searchParams.get("next") ?? "/trails";

  useEffect(() => {
    if (sentRef.current) return;
    if (!code || !codeVerifier || !redirectUri) {
      window.location.replace(next);
      return;
    }
    sentRef.current = true;

    const message = {
      source: SITE_SOURCE,
      type: "AUTH_CODE_RELAY",
      requestId: crypto.randomUUID(),
      timestamp: Date.now(),
      code,
      codeVerifier,
      redirectUri,
    };

    window.postMessage(message, window.location.origin);

    const timer = setTimeout(() => {
      window.location.replace(next);
    }, RELAY_TIMEOUT_MS);

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (
        data &&
        typeof data === "object" &&
        data.source === "trail-extension" &&
        data.type === "AUTH_CODE_RELAY_ACK"
      ) {
        clearTimeout(timer);
        window.location.replace(next);
      }
    }

    window.addEventListener("message", onMessage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [code, codeVerifier, redirectUri, next]);

  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <p className="text-sm text-muted-foreground">
        Connecting to Trail extension…
      </p>
    </div>
  );
}

export default function ExtensionRelayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[200px] items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <ExtensionRelayInner />
    </Suspense>
  );
}
