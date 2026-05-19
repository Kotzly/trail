"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { evaluatePasswordPolicy } from "@/lib/password-policy";
import { INSTALL_URL } from "@/lib/install-url";

type PageStatus =
  | { kind: "verifying" }
  | { kind: "ready" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "expired" }
  | { kind: "error"; message: string };

/**
 * Password-reset landing page. The email link from Supabase points
 * here with `?code=<recovery>`; the browser client exchanges the code
 * for a short-lived recovery session, then `updateUser({ password })`
 * persists the new password. See `extension/src/shared/auth/auth-orchestrator.ts`
 * for the matching `resetPasswordForEmail` call that mints the email.
 */
export default function ResetPasswordPage() {
  // Lazy-instantiate the Supabase client inside the effect rather than
  // at component-init / module-init time. Static prerendering (running
  // server-side with placeholder env vars) doesn't get to construct it.
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createSupabaseBrowserClient();
    }
    return supabaseRef.current;
  }, []);

  const [status, setStatus] = useState<PageStatus>({ kind: "verifying" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // Exchange the `?code=` for a session on mount. Signing the user out
  // first prevents the very-rare cross-account confusion case where
  // someone is already signed-in to gettrail.net under account A and
  // clicks a reset link for account B (premortem #5).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabase();
        await supabase.auth.signOut().catch(() => undefined);
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (!code) {
          setStatus({ kind: "expired" });
          return;
        }
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          // Stale, single-use, or otherwise rejected.
          setStatus({ kind: "expired" });
          return;
        }
        setStatus({ kind: "ready" });
      } catch (err) {
        if (cancelled) return;
        setStatus({
          kind: "error",
          message:
            err instanceof Error ? err.message : "Couldn't verify the link.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getSupabase]);

  const policy = useMemo(() => evaluatePasswordPolicy(password), [password]);
  const passwordsMatch = password === confirm;
  const submitting = status.kind === "submitting";
  const canSubmit = policy.valid && passwordsMatch && status.kind === "ready";

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit) return;
      setStatus({ kind: "submitting" });
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setStatus({
          kind: "error",
          message:
            error.message ??
            "Couldn't update your password. Try requesting a new link.",
        });
        return;
      }
      // Don't leave a marketing-domain session lingering — the user
      // is meant to continue in the extension. Sign out and surface
      // the success screen with a CTA back into the extension.
      await supabase.auth.signOut().catch(() => undefined);
      setStatus({ kind: "success" });
    },
    [canSubmit, password, getSupabase],
  );

  if (status.kind === "verifying") {
    return (
      <Card title="Verifying your link...">
        <p className="text-sm text-muted-foreground">One moment.</p>
      </Card>
    );
  }

  if (status.kind === "expired") {
    return (
      <Card title="This link has expired">
        <p className="text-sm text-muted-foreground">
          Reset links can only be used once and stay valid for a short window.
          Request a new link from the Trail extension&apos;s sign-in screen.
        </p>
      </Card>
    );
  }

  if (status.kind === "success") {
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

  return (
    <Card title="Set a new password">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
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
              className={hint.ok ? "text-emerald-600" : "text-muted-foreground"}
            >
              {hint.ok ? "✓" : "·"} {hint.label}
            </li>
          ))}
        </ul>
        {status.kind === "error" ? (
          <p className="text-sm text-destructive">{status.message}</p>
        ) : null}
        <Button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? "Saving..." : "Set new password"}
        </Button>
      </form>
    </Card>
  );
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
