"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/src/auth-client";

const buildBridgeUrl = (returnTo: string) =>
  `/auth/bridge?returnTo=${encodeURIComponent(returnTo)}`;

const normalizeError = (error: unknown): string => {
  if (!error) {
    return "Something went wrong.";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? error);
  }
  return "Something went wrong.";
};

const resolveRedirectUrl = (data: unknown): string | null => {
  if (!data || typeof data !== "object") {
    return null;
  }
  const record = data as Record<string, unknown>;
  const candidate = record.url ?? record.redirect;
  return typeof candidate === "string" ? candidate : null;
};

const mainStyle: CSSProperties = {
  margin: "0 auto",
  maxWidth: "420px",
  padding: "48px 24px",
  fontFamily: "system-ui, -apple-system, sans-serif",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const buttonStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #111827",
  background: "#111827",
  color: "#ffffff",
};

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/";
  const bridgeUrl = useMemo(() => buildBridgeUrl(returnTo), [returnTo]);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogle = async () => {
    setError(null);
    setIsLoading(true);

    const { data, error: socialError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: bridgeUrl,
    });

    setIsLoading(false);

    if (socialError) {
      setError(normalizeError(socialError));
      return;
    }

    const redirectUrl = resolveRedirectUrl(data);
    if (redirectUrl) {
      window.location.assign(redirectUrl);
      return;
    }

    router.push(bridgeUrl);
  };

  return (
    <main style={mainStyle}>
      <header style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>trail</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Continue with Google to sign in.
        </p>
      </header>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={isLoading}
        style={{
          ...buttonStyle,
          cursor: isLoading ? "not-allowed" : "pointer",
          opacity: isLoading ? 0.75 : 1,
        }}
      >
        {isLoading ? "Google..." : "Continue with Google"}
      </button>

      {error ? (
        <p role="alert" style={{ margin: 0, color: "#b91c1c" }}>
          {error}
        </p>
      ) : null}
    </main>
  );
}

