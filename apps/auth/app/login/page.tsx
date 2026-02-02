"use client";

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

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/";
  const bridgeUrl = useMemo(() => buildBridgeUrl(returnTo), [returnTo]);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<
    "google" | "github" | null
  >(null);

  const handleSendOtp = async () => {
    if (!email) {
      setError("Введите email, чтобы получить код.");
      return;
    }

    setError(null);
    setStatus(null);
    setIsSending(true);

    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in"
    });

    setIsSending(false);

    if (sendError) {
      setError(normalizeError(sendError));
      return;
    }

    setStatus("Код отправлен. Проверьте почту.");
  };

  const handleSignIn = async () => {
    if (!email || !otp) {
      setError("Введите email и код из письма.");
      return;
    }

    setError(null);
    setStatus(null);
    setIsSigningIn(true);

    const { error: signInError } = await authClient.signIn.emailOtp({
      email,
      otp
    });

    setIsSigningIn(false);

    if (signInError) {
      setError(normalizeError(signInError));
      return;
    }

    router.push(bridgeUrl);
  };

  const handleSocial = async (provider: "google" | "github") => {
    setError(null);
    setStatus(null);
    setOauthLoading(provider);

    const { data, error: socialError } = await authClient.signIn.social({
      provider,
      callbackURL: bridgeUrl
    });

    setOauthLoading(null);

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
    <main
      style={{
        margin: "0 auto",
        maxWidth: "420px",
        padding: "48px 24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <h1 style={{ margin: 0, fontSize: "28px" }}>Trail вход</h1>
        <p style={{ margin: 0, color: "#4b5563" }}>
          Получите одноразовый код или войдите через OAuth.
        </p>
      </header>

      <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db"
          }}
        />
      </label>

      <button
        type="button"
        onClick={handleSendOtp}
        disabled={isSending}
        style={{
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid #111827",
          background: "#111827",
          color: "#ffffff",
          cursor: isSending ? "not-allowed" : "pointer"
        }}
      >
        {isSending ? "Отправляем код…" : "Отправить код"}
      </button>

      <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        Код из письма
        <input
          type="text"
          value={otp}
          onChange={(event) => setOtp(event.target.value)}
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db"
          }}
        />
      </label>

      <button
        type="button"
        onClick={handleSignIn}
        disabled={isSigningIn}
        style={{
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid #111827",
          background: "#ffffff",
          color: "#111827",
          cursor: isSigningIn ? "not-allowed" : "pointer"
        }}
      >
        {isSigningIn ? "Входим…" : "Войти"}
      </button>

      <div
        style={{
          marginTop: "8px",
          fontSize: "14px",
          color: "#6b7280"
        }}
      >
        Или продолжить через
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        <button
          type="button"
          onClick={() => handleSocial("google")}
          disabled={oauthLoading === "google"}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            background: "#ffffff",
            cursor: oauthLoading === "google" ? "not-allowed" : "pointer"
          }}
        >
          {oauthLoading === "google" ? "Google…" : "Google"}
        </button>
        <button
          type="button"
          onClick={() => handleSocial("github")}
          disabled={oauthLoading === "github"}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            background: "#ffffff",
            cursor: oauthLoading === "github" ? "not-allowed" : "pointer"
          }}
        >
          {oauthLoading === "github" ? "GitHub…" : "GitHub"}
        </button>
      </div>

      {status ? (
        <p role="status" style={{ margin: 0, color: "#047857" }}>
          {status}
        </p>
      ) : null}

      {error ? (
        <p role="alert" style={{ margin: 0, color: "#b91c1c" }}>
          {error}
        </p>
      ) : null}
    </main>
  );
}
