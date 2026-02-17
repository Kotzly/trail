"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const SITE_SOURCE = "trail-site" as const;
const RELAY_TIMEOUT_MS = 5_000;

/**
 * Navigate through /auth/callback so the route can validate the Better Auth
 * session and set a fresh trail_auth_session cookie in the same redirect hop
 * to the final destination. Going directly to a protected page (e.g. /trails)
 * can fail when the cookie set during a prior redirect chain hasn't settled.
 */
function navigateViaCallback(next: string): void {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", next);
  window.location.replace(url.toString());
}

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
      navigateViaCallback(next);
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
      navigateViaCallback(next);
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
        navigateViaCallback(next);
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
