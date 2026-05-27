"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Sign-in gate shown when `get_shared_trail` returns
 * `{ access: "restricted" }` — the share exists but the caller isn't on
 * its email allowlist.
 *
 * Flow: 6-digit email OTP (NOT a magic link). The Supabase email
 * template (`supabase/templates/magic_link.html`) deliberately renders
 * `{{ .Token }}` — a code, with no clickable `{{ .ConfirmationURL }}` —
 * because the extension can't consume magic links (Chrome opens them
 * outside its storage origin). So the web gate must collect the code,
 * not wait for a link click. Two steps:
 *
 *   1. Email → `signInWithOtp({ shouldCreateUser: false })`. The owner
 *      invites by email and viewers must be existing Trail users, so an
 *      unknown email gets an actionable "install Trail + sign up first"
 *      message rather than silently advancing.
 *   2. Code → `verifyOtp({ type: "email" })`. On success we hard-reload
 *      so the server component re-runs `get_shared_trail` with the new
 *      auth cookies and renders the granted trail (or, if the owner
 *      invited a different address, the "not on allowlist" branch).
 *
 * If the visitor is already signed in but still landed here (their email
 * isn't on the ACL), show "that address isn't on the allowlist" and let
 * them sign out + retry with a different account.
 */
export function RestrictedShareGate({
  authenticated,
}: {
  code: string;
  authenticated: boolean;
}) {
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createSupabaseBrowserClient();
    }
    return supabaseRef.current;
  }, []);

  // Two-step machine: collect the email, then the 6-digit code.
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [callerEmail, setCallerEmail] = useState<string | null>(null);

  // If the visitor is already signed in, read back their email so we can
  // render "Signed in as <email> — but not on the allowlist."
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getSupabase().auth.getUser();
        if (!cancelled) setCallerEmail(data.user?.email ?? null);
      } catch {
        // best-effort — gate renders fine without the email
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getSupabase]);

  const sendCode = useCallback(
    async (target: string) => {
      setError(null);
      setNotice(null);
      setSending(true);
      try {
        const { error: sendError } = await getSupabase().auth.signInWithOtp({
          email: target,
          // No `emailRedirectTo`: the email carries a code, not a link, so
          // there's no redirect to honour. `shouldCreateUser: false` keeps
          // the public gate from minting accounts — viewers must already
          // be Trail users (web auth surface is deliberately minimal).
          options: { shouldCreateUser: false },
        });
        if (sendError) {
          setError(describeSendError(sendError));
          return false;
        }
        setStep("code");
        setNotice(`We sent a 6-digit code to ${target}. Enter it below.`);
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't send the code.",
        );
        return false;
      } finally {
        setSending(false);
      }
    },
    [getSupabase],
  );

  const handleEmailSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !trimmed.includes("@")) {
        setError("Enter a valid email address.");
        return;
      }
      setEmail(trimmed);
      void sendCode(trimmed);
    },
    [email, sendCode],
  );

  const handleCodeSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const token = code.replace(/\s+/g, "");
      if (!/^\d{6}$/.test(token)) {
        setError("Enter the 6-digit code from your email.");
        return;
      }
      setError(null);
      setNotice(null);
      setVerifying(true);
      try {
        const { error: verifyError } = await getSupabase().auth.verifyOtp({
          email,
          token,
          type: "email",
        });
        if (verifyError) {
          setError(describeVerifyError(verifyError));
          return;
        }
        // Session cookies are now set by the browser client; hard-reload
        // so the server component re-runs get_shared_trail with the new
        // auth.email() and renders the granted trail (or the "not on
        // allowlist" branch if the owner invited a different address).
        setVerified(true);
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign-in failed.");
      } finally {
        setVerifying(false);
      }
    },
    [code, email, getSupabase],
  );

  const handleResend = useCallback(() => {
    setCode("");
    void sendCode(email);
  }, [email, sendCode]);

  const handleUseDifferentEmail = useCallback(() => {
    setStep("email");
    setCode("");
    setError(null);
    setNotice(null);
  }, []);

  const handleSignOut = useCallback(async () => {
    await getSupabase()
      .auth.signOut()
      .catch(() => undefined);
    window.location.reload();
  }, [getSupabase]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Trail
      </Link>

      <div className="mt-10 rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">
          This trail is private
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The person who shared it limited access to specific people. Sign in
          with the email address they invited.
        </p>

        {authenticated ? (
          <div className="mt-6 space-y-3 text-sm">
            <p className="rounded-md border bg-muted/30 px-3 py-2">
              You&apos;re signed in
              {callerEmail ? (
                <>
                  {" "}
                  as <strong className="font-medium">{callerEmail}</strong>
                </>
              ) : null}
              , but that address isn&apos;t on the allowlist for this share.
            </p>
            <Button variant="outline" onClick={() => void handleSignOut()}>
              Sign in with a different email
            </Button>
          </div>
        ) : step === "email" ? (
          <form
            className="mt-6 flex flex-col gap-3"
            onSubmit={handleEmailSubmit}
          >
            <label htmlFor="restricted-email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="restricted-email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={sending}>
              {sending ? "Sending..." : "Email me a code"}
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <p className="text-xs text-muted-foreground">
              We&apos;ll email you a 6-digit code. It works only for emails the
              share owner invited, and you need a Trail account with that
              address — sign up in the{" "}
              <Link href="/" className="underline-offset-2 hover:underline">
                Trail extension
              </Link>{" "}
              first if you don&apos;t have one.
            </p>
          </form>
        ) : (
          <form
            className="mt-6 flex flex-col gap-3"
            onSubmit={handleCodeSubmit}
          >
            <label htmlFor="restricted-code" className="text-sm font-medium">
              6-digit code
            </label>
            <Input
              id="restricted-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
            <Button type="submit" disabled={verifying || verified}>
              {verifying || verified ? "Verifying..." : "Verify & view trail"}
            </Button>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : notice ? (
              <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                {notice}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3 text-xs">
              <button
                type="button"
                onClick={handleResend}
                disabled={sending}
                className="text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
              >
                {sending ? "Resending..." : "Resend code"}
              </button>
              <button
                type="button"
                onClick={handleUseDifferentEmail}
                className="text-muted-foreground underline-offset-2 hover:underline"
              >
                Use a different email
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

/**
 * Map a `signInWithOtp` failure to actionable copy. Unknown emails come
 * back as "Signups not allowed" / user-not-found (because
 * `shouldCreateUser: false`); on this owner-invited ACL surface that's a
 * legitimate, actionable signal, not an enumeration leak worth hiding.
 */
function describeSendError(error: AuthError): string {
  const msg = error.message ?? "";
  if (
    /signups?\s+not\s+allowed|user\s+not\s+found|signup.*disabled/i.test(msg)
  ) {
    return "We couldn't find a Trail account for that email. Install the Trail extension and sign up with this address first, then try again.";
  }
  if (
    error.code === "over_email_send_rate_limit" ||
    /rate.?limit|too many|after \d+ seconds|for security purposes/i.test(msg)
  ) {
    return "Too many requests — wait a moment, then try again.";
  }
  return msg || "Couldn't send the code. Try again in a moment.";
}

/** Map a `verifyOtp` failure to actionable copy. */
function describeVerifyError(error: AuthError): string {
  const msg = error.message ?? "";
  if (error.code === "otp_expired" || /expired|invalid/i.test(msg)) {
    return "That code is invalid or expired. Resend a fresh code and try again.";
  }
  if (
    error.code === "over_request_rate_limit" ||
    /rate.?limit|too many/i.test(msg)
  ) {
    return "Too many attempts — wait a moment, then try again.";
  }
  return msg || "Couldn't verify that code.";
}
