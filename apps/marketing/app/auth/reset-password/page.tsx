"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { evaluatePasswordPolicy } from "@/lib/password-policy";
import { INSTALL_URL } from "@/lib/install-url";

/**
 * Self-service password-reset page (6-digit OTP, NOT a magic link).
 *
 * The recovery email (`supabase/templates/recovery.html`) renders
 * `{{ .Token }}` — a code, with no clickable `{{ .ConfirmationURL }}` —
 * because the extension can't consume magic links (Chrome opens them
 * outside its storage origin). So this page must collect the code, not
 * wait for a link click. Three steps, all on this page:
 *
 *   1. Email → `resetPasswordForEmail` sends the recovery code. We swallow
 *      "user not found" so the page never leaks which emails have accounts
 *      (recovery is a classic enumeration target).
 *   2. Code → `verifyOtp({ type: "recovery" })` opens a short-lived
 *      recovery session.
 *   3. New password → `updateUser({ password })`, then sign out (the user
 *      continues in the extension).
 *
 * Matches the extension's recovery flow
 * (`extension/src/shared/auth/orchestrator/recovery.ts`).
 */
type Step = "email" | "code" | "password" | "success";

export default function ResetPasswordPage() {
  // Lazy-instantiate the Supabase client inside an effect rather than at
  // module-init — static prerendering (placeholder env vars) must not
  // construct it.
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createSupabaseBrowserClient();
    }
    return supabaseRef.current;
  }, []);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Clear any lingering marketing-domain session on mount. Prevents the
  // cross-account case where someone signed in here as A resets a password
  // for B (premortem #5); verifyOtp below will mint B's recovery session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getSupabase().auth.signOut();
      } catch {
        // best-effort
      }
      if (!cancelled) setStep("email");
    })();
    return () => {
      cancelled = true;
    };
  }, [getSupabase]);

  const sendCode = useCallback(
    async (target: string) => {
      setError(null);
      setNotice(null);
      setBusy(true);
      try {
        const { error: sendError } =
          await getSupabase().auth.resetPasswordForEmail(target, {
            // Land on this page if the email ever does carry a link. The
            // template is code-only today, so the user reads the code and
            // types it below either way.
            redirectTo: `${window.location.origin}/auth/reset-password`,
          });
        // Swallow "user not found" — never reveal which emails have
        // accounts. Real users get a code; unknown ones see the same UI.
        if (sendError && !isEnumerationLeak(sendError)) {
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
        setBusy(false);
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
      setBusy(true);
      try {
        const { error: verifyError } = await getSupabase().auth.verifyOtp({
          email,
          token,
          type: "recovery",
        });
        if (verifyError) {
          setError(describeVerifyError(verifyError));
          return;
        }
        setStep("password");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign-in failed.");
      } finally {
        setBusy(false);
      }
    },
    [code, email, getSupabase],
  );

  const policy = useMemo(() => evaluatePasswordPolicy(password), [password]);
  const passwordsMatch = password === confirm;
  const canSubmitPassword = policy.valid && passwordsMatch && !busy;

  const handlePasswordSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmitPassword) return;
      setError(null);
      setBusy(true);
      try {
        const supabase = getSupabase();
        const { error: updateError } = await supabase.auth.updateUser({
          password,
        });
        if (updateError) {
          setError(
            updateError.message ??
              "Couldn't update your password. Request a fresh code and try again.",
          );
          return;
        }
        // Don't leave a marketing-domain session lingering — the user is
        // meant to continue in the extension.
        await supabase.auth.signOut().catch(() => undefined);
        setStep("success");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't update your password.",
        );
      } finally {
        setBusy(false);
      }
    },
    [canSubmitPassword, password, getSupabase],
  );

  if (step === "success") {
    return (
      <Card title="Password updated">
        <p className="text-sm text-muted-foreground">
          Open the Trail extension in your browser and sign in with your new
          password.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <a href={INSTALL_URL} target="_blank" rel="noopener noreferrer">
              Open Chrome Web Store
            </a>
          </Button>
        </div>
      </Card>
    );
  }

  if (step === "password") {
    return (
      <Card title="Set a new password">
        <form className="flex flex-col gap-4" onSubmit={handlePasswordSubmit}>
          <div className="flex flex-col gap-1">
            <label htmlFor="reset-password" className="text-sm font-medium">
              New password
            </label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="reset-confirm" className="text-sm font-medium">
              Confirm password
            </label>
            <Input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {!passwordsMatch && confirm.length > 0 ? (
              <p className="text-xs text-destructive">
                Passwords don&apos;t match.
              </p>
            ) : null}
          </div>
          <ul className="space-y-1 text-xs">
            {policy.hints.map((hint) => (
              <li
                key={hint.label}
                className={
                  hint.ok ? "text-emerald-600" : "text-muted-foreground"
                }
              >
                {hint.ok ? "✓" : "·"} {hint.label}
              </li>
            ))}
          </ul>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={!canSubmitPassword}>
            {busy ? "Saving..." : "Set new password"}
          </Button>
        </form>
      </Card>
    );
  }

  if (step === "code") {
    return (
      <Card title="Enter your reset code">
        <form className="flex flex-col gap-3" onSubmit={handleCodeSubmit}>
          <label htmlFor="reset-code" className="text-sm font-medium">
            6-digit code
          </label>
          <Input
            id="reset-code"
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
          <Button type="submit" disabled={busy}>
            {busy ? "Verifying..." : "Verify code"}
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
              onClick={() => {
                setCode("");
                void sendCode(email);
              }}
              disabled={busy}
              className="text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
            >
              Resend code
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
                setNotice(null);
              }}
              className="text-muted-foreground underline-offset-2 hover:underline"
            >
              Use a different email
            </button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card title="Reset your password">
      <form className="flex flex-col gap-3" onSubmit={handleEmailSubmit}>
        <p className="text-sm text-muted-foreground">
          Enter your account email and we&apos;ll send you a 6-digit code to
          reset your password.
        </p>
        <label htmlFor="reset-email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="reset-email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Sending..." : "Email me a code"}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>
    </Card>
  );
}

function isEnumerationLeak(error: AuthError): boolean {
  const msg = error.message ?? "";
  return error.code === "user_not_found" || /user not found/i.test(msg);
}

function describeSendError(error: AuthError): string {
  const msg = error.message ?? "";
  if (
    error.code === "over_email_send_rate_limit" ||
    /rate.?limit|too many|after \d+ seconds|for security purposes/i.test(msg)
  ) {
    return "Too many requests — wait a moment, then try again.";
  }
  return msg || "Couldn't send the code. Try again in a moment.";
}

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

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-4">{children}</div>
    </div>
  );
}
