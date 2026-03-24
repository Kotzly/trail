"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import TrailLogo from "@/components/TrailLogo";

const SITE_SOURCE = "trail-site" as const;
const RELAY_TIMEOUT_MS = 5_000;
const DEFAULT_NEXT_PATH = "/trails";

/** Reject dangerous schemes and ensure the URL is a safe relative path or same-origin. */
function sanitizeNextUrl(raw: string | null): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_NEXT_PATH;

  // Block javascript:, data:, vbscript:, and any other non-http(s) scheme
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:/i.test(value)) {
    return DEFAULT_NEXT_PATH;
  }

  // Block protocol-relative URLs (e.g. //evil.com) which bypass scheme checks
  // but redirect to external origins.
  if (value.startsWith("//")) return DEFAULT_NEXT_PATH;

  // Allow relative paths (starting with /)
  if (value.startsWith("/")) return value;

  // Allow same-origin absolute URLs when running in a browser
  if (typeof window !== "undefined" && /^https?:/i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.origin === window.location.origin) return parsed.pathname + parsed.search + parsed.hash;
    } catch {
      // malformed — fall through
    }
  }

  return DEFAULT_NEXT_PATH;
}

type RelayStatus = "connecting" | "connected";

function ExtensionRelayInner() {
  const searchParams = useSearchParams();
  const sentRef = useRef(false);
  const [status, setStatus] = useState<RelayStatus>("connecting");

  const code = searchParams.get("code");
  const codeVerifier = searchParams.get("codeVerifier");
  const redirectUri = searchParams.get("redirectUri");
  const next = sanitizeNextUrl(searchParams.get("next"));

  useEffect(() => {
    if (!code || !codeVerifier || !redirectUri) {
      // Page loaded without expected params — redirect through callback to
      // re-establish the session cookie and land on the destination page.
      const url = new URL("/auth/callback", window.location.origin);
      url.searchParams.set("next", next);
      window.location.replace(url.toString());
      return;
    }

    // Post the auth code only once (skip on React strict-mode remount).
    if (!sentRef.current) {
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
    }

    // Always set up the timer + listener, even on strict-mode remount,
    // because cleanup kills them.
    const timer = setTimeout(() => {
      setStatus("connected");
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
        setStatus("connected");
      }
    }

    window.addEventListener("message", onMessage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [code, codeVerifier, redirectUri, next]);

  if (status === "connected") {
    return (
      <main className="flex flex-col items-center gap-6 py-12 text-center">
        <header className="flex flex-col items-center gap-4">
          <TrailLogo animated label="Trail" />
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              extension connected
            </h1>
            <p className="text-sm text-muted-foreground">
              You can close this tab or head to your dashboard.
            </p>
          </div>
        </header>

        <a
          href={next}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Go to dashboard
        </a>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center gap-6 py-12 text-center">
      <header className="flex flex-col items-center gap-4">
        <TrailLogo label="Trail" />
        <div className="space-y-1 text-center">
          <p className="text-sm text-muted-foreground">
            Connecting to Trail extension…
          </p>
        </div>
      </header>
    </main>
  );
}

export default function ExtensionRelayPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-col items-center gap-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      }
    >
      <ExtensionRelayInner />
    </Suspense>
  );
}
