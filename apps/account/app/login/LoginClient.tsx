"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/src/auth-client";
import { requestAuthBridgeCode } from "@/src/lib/trail-extension";

const INSECURE_AUTH_PASSWORD = "trail-dev-insecure-auth";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const buildBridgeUrl = (returnTo: string) =>
  `/auth/bridge?returnTo=${encodeURIComponent(returnTo)}`;

const buildCallbackUrl = (returnTo: string): URL => {
  const fallback = new URL("/auth/callback", window.location.origin);

  try {
    const candidate = new URL(returnTo, window.location.origin);
    if (candidate.pathname === "/auth/callback") {
      return candidate;
    }
  } catch {
    // Ignore invalid returnTo and fall back to /auth/callback.
  }

  if (returnTo.startsWith("/")) {
    fallback.searchParams.set("next", returnTo);
  }

  return fallback;
};

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

const inputStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "14px",
};

const toNameFromEmail = (email: string): string =>
  email.split("@")[0]?.trim() || "trail user";

// region INSECURE_AUTH
const toInsecureAuthEmail = (email: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < email.length; index += 1) {
    hash ^= email.charCodeAt(index);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const token = (hash >>> 0).toString(36);
  return `insecure-${token}@trail.local`;
};
// endregion INSECURE_AUTH

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/";
  const bridgeUrl = useMemo(() => buildBridgeUrl(returnTo), [returnTo]);

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSilentSyncing, setIsSilentSyncing] = useState(false);
  const [silentSyncError, setSilentSyncError] = useState<string | null>(null);
  const [showSilentSyncModal, setShowSilentSyncModal] = useState(false);
  const attemptedSilentSyncRef = useRef(false);

  const runSilentSync = useCallback(
    async (force: boolean) => {
      if (attemptedSilentSyncRef.current && !force) {
        return;
      }
      attemptedSilentSyncRef.current = true;
      setSilentSyncError(null);
      setIsSilentSyncing(true);

      const result = await requestAuthBridgeCode();
      if (!result.ok) {
        setIsSilentSyncing(false);
        setSilentSyncError(result.error || "Could not sync extension session.");
        setShowSilentSyncModal(true);
        return;
      }

      const callbackUrl = buildCallbackUrl(returnTo);
      callbackUrl.searchParams.set("code", result.data.code);
      window.location.assign(callbackUrl.toString());
    },
    [returnTo],
  );

  useEffect(() => {
    void runSilentSync(false);
  }, [runSilentSync]);

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);

    const { data, error: socialError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: bridgeUrl,
    });

    if (socialError) {
      setIsLoading(false);
      setError(normalizeError(socialError));
      return;
    }

    const redirectUrl = resolveRedirectUrl(data);
    setIsLoading(false);
    if (redirectUrl) {
      window.location.assign(redirectUrl);
      return;
    }

    router.push(bridgeUrl);
  };

  const handleEmailLogin = async () => {
    setError(null);
    setIsLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setIsLoading(false);
      setError("Enter your email.");
      return;
    }
    const authEmail = toInsecureAuthEmail(normalizedEmail);

    const signInResult = await authClient.signIn.email({
      email: authEmail,
      password: INSECURE_AUTH_PASSWORD,
      callbackURL: bridgeUrl,
      rememberMe: true,
    });

    if (signInResult.error) {
      const signUpResult = await authClient.signUp.email({
        email: authEmail,
        name: toNameFromEmail(normalizedEmail),
        password: INSECURE_AUTH_PASSWORD,
        callbackURL: bridgeUrl,
      });

      if (signUpResult.error) {
        setIsLoading(false);
        setError(normalizeError(signUpResult.error));
        return;
      }

      const signUpRedirectUrl = resolveRedirectUrl(signUpResult.data);
      setIsLoading(false);
      if (signUpRedirectUrl) {
        window.location.assign(signUpRedirectUrl);
        return;
      }

      router.push(bridgeUrl);
      return;
    }

    setIsLoading(false);
    const redirectUrl = resolveRedirectUrl(signInResult.data);
    if (redirectUrl) {
      window.location.assign(redirectUrl);
      return;
    }

    router.push(bridgeUrl);
  };

  return (
    <main style={mainStyle}>
      {showSilentSyncModal ? (
        <section
          role="dialog"
          aria-modal="true"
          style={{
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            background: "#f9fafb",
          }}
        >
          <strong>Could not sync extension session</strong>
          <p style={{ margin: 0, color: "#4b5563", fontSize: "14px" }}>
            {silentSyncError ?? "Try again or continue with manual sign in."}
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => void runSilentSync(true)}
              disabled={isSilentSyncing || isLoading}
              style={{
                ...buttonStyle,
                cursor:
                  isSilentSyncing || isLoading ? "not-allowed" : "pointer",
              }}
            >
              {isSilentSyncing ? "Retrying..." : "Retry sync"}
            </button>
            <button
              type="button"
              onClick={() => setShowSilentSyncModal(false)}
              disabled={isSilentSyncing || isLoading}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#111827",
                cursor:
                  isSilentSyncing || isLoading ? "not-allowed" : "pointer",
              }}
            >
              Continue manually
            </button>
          </div>
        </section>
      ) : null}

      <header style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>trail</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          {IS_PRODUCTION ? "Continue with Google to sign in." : "Enter email to sign in."}
        </p>
      </header>

      {IS_PRODUCTION ? (
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading || isSilentSyncing}
          style={{
            ...buttonStyle,
            cursor: isLoading || isSilentSyncing ? "not-allowed" : "pointer",
            opacity: isLoading || isSilentSyncing ? 0.75 : 1,
          }}
        >
          {isLoading || isSilentSyncing ? "Redirecting..." : "Continue with Google"}
        </button>
      ) : (
        <>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            style={inputStyle}
            disabled={isLoading || isSilentSyncing}
          />
          <button
            type="button"
            onClick={handleEmailLogin}
            disabled={isLoading || isSilentSyncing}
            style={{
              ...buttonStyle,
              cursor: isLoading || isSilentSyncing ? "not-allowed" : "pointer",
              opacity: isLoading || isSilentSyncing ? 0.75 : 1,
            }}
          >
            {isLoading || isSilentSyncing ? "Signing in..." : "Continue"}
          </button>
        </>
      )}

      {error ? (
        <p role="alert" style={{ margin: 0, color: "#b91c1c" }}>
          {error}
        </p>
      ) : null}
    </main>
  );
}
