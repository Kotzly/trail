"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/src/auth-client";

const INSECURE_AUTH_PASSWORD = "trail-dev-insecure-auth";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

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

function resolveCallbackUrl(returnToParam: string | null): string {
  if (typeof window === "undefined") {
    return "/auth/callback";
  }

  if (!returnToParam) {
    return new URL("/auth/callback", window.location.origin).toString();
  }

  try {
    const absolute = new URL(returnToParam);
    if (absolute.origin === window.location.origin) {
      return absolute.toString();
    }
  } catch {
    // ignore
  }

  if (returnToParam.startsWith("/")) {
    return new URL(returnToParam, window.location.origin).toString();
  }

  return new URL("/auth/callback", window.location.origin).toString();
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo = searchParams.get("returnTo");
  const prompt = searchParams.get("prompt");
  const maxAge = searchParams.get("maxAge") ?? "0";

  const callbackUrl = useMemo(() => resolveCallbackUrl(returnTo), [returnTo]);

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);

    const socialInput: Record<string, unknown> = {
      provider: "google",
      callbackURL: callbackUrl,
    };

    if (prompt === "select_account") {
      socialInput.fetchOptions = {
        query: {
          prompt: "select_account",
          max_age: maxAge,
        },
      };
    }

    const { data, error: socialError } = await (authClient.signIn.social as (
      input: Record<string, unknown>,
    ) => Promise<{ data?: unknown; error?: unknown }>)(socialInput);

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

    router.push(callbackUrl);
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
      callbackURL: callbackUrl,
      rememberMe: true,
    });

    if (signInResult.error) {
      const signUpResult = await authClient.signUp.email({
        email: authEmail,
        name: toNameFromEmail(normalizedEmail),
        password: INSECURE_AUTH_PASSWORD,
        callbackURL: callbackUrl,
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

      router.push(callbackUrl);
      return;
    }

    setIsLoading(false);
    const redirectUrl = resolveRedirectUrl(signInResult.data);
    if (redirectUrl) {
      window.location.assign(redirectUrl);
      return;
    }

    router.push(callbackUrl);
  };

  return (
    <main style={mainStyle}>
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
          disabled={isLoading}
          style={{
            ...buttonStyle,
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.75 : 1,
          }}
        >
          {isLoading ? "Redirecting..." : "Continue with Google"}
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
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={handleEmailLogin}
            disabled={isLoading}
            style={{
              ...buttonStyle,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.75 : 1,
            }}
          >
            {isLoading ? "Signing in..." : "Continue"}
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
