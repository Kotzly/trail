"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const SITE_SOURCE = "trail-site" as const;
const RELAY_TIMEOUT_MS = 5_000;
const DEFAULT_NEXT_PATH = "/";

function sanitizeNextUrl(raw: string | null): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_NEXT_PATH;

  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:/i.test(value)) {
    return DEFAULT_NEXT_PATH;
  }

  if (value.startsWith("//")) return DEFAULT_NEXT_PATH;
  if (value.startsWith("/")) return value;

  if (typeof window !== "undefined" && /^https?:/i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.origin === window.location.origin)
        return parsed.pathname + parsed.search + parsed.hash;
    } catch {
      // malformed
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
      const url = new URL("/auth/callback", window.location.origin);
      url.searchParams.set("next", next);
      window.location.replace(url.toString());
      return;
    }

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
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          padding: "3rem 1rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          Extension connected
        </h1>
        <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
          You can close this tab.
        </p>
        <a
          href={next}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.625rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #e5e7eb",
            fontSize: "0.875rem",
            fontWeight: 500,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          Continue
        </a>
      </main>
    );
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
        padding: "3rem 1rem",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
        Connecting to Trail extension…
      </p>
    </main>
  );
}

export default function ExtensionRelayPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "3rem 1rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>Loading…</p>
        </main>
      }
    >
      <ExtensionRelayInner />
    </Suspense>
  );
}
