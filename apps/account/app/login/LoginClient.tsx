"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/src/auth-client";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={18} height={18}>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function normalizeError(error: unknown): string {
  if (!error) return "Something went wrong.";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? error);
  }
  return "Something went wrong.";
}

function resolveRedirectUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const candidate = record.url ?? record.redirect;
  return typeof candidate === "string" ? candidate : null;
}

function resolveCallbackUrl(returnToParam: string | null): string {
  if (typeof window === "undefined") return "/auth/callback";

  const origin = window.location.origin;

  if (!returnToParam) {
    return new URL("/auth/callback", origin).toString();
  }

  try {
    const absolute = new URL(returnToParam);
    if (absolute.origin === origin) return absolute.toString();
  } catch {
    // not an absolute URL
  }

  if (returnToParam.startsWith("/") && !returnToParam.startsWith("//")) {
    return new URL(returnToParam, origin).toString();
  }

  return new URL("/auth/callback", origin).toString();
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo = searchParams.get("returnTo");
  const prompt = searchParams.get("prompt");
  const maxAge = searchParams.get("maxAge") ?? "0";

  const callbackUrl = useMemo(() => resolveCallbackUrl(returnTo), [returnTo]);

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

  return (
    <main className="flex flex-col items-center gap-6 py-12 text-center">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">trail</h1>
        <p className="text-sm text-muted-foreground">
          Continue with Google to sign in.
        </p>
      </header>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx={12}
                cy={12}
                r={10}
                stroke="currentColor"
                strokeWidth={4}
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            Redirecting…
          </>
        ) : (
          <>
            <GoogleIcon className="shrink-0" />
            Continue with Google
          </>
        )}
      </button>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </main>
  );
}
