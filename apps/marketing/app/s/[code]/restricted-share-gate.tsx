"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Sign-in gate shown when `get_shared_trail` returns
 * `{ access: "restricted" }`. Two paths:
 *
 *  * `?code=...` in the URL (Supabase recovery / magic-link callback)
 *    — exchange it for a session, then hard-reload so the server-
 *    rendered share page re-runs `get_shared_trail` with the new
 *    auth.email() and (hopefully) renders the granted detail.
 *  * No `?code=` — render a magic-link form. We call
 *    `signInWithOtp({ email, emailRedirectTo: <this URL> })` so the
 *    email link lands back on the same /s/<code> with the OAuth code
 *    in the query string, completing the round trip.
 *
 * If the visitor is already signed in but still landed on this gate
 * (their email isn't on the ACL), show "ask the share owner to add
 * <your-email>" — and let them sign out + retry with a different
 * account.
 */
export function RestrictedShareGate({
  code,
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

  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "exchanging" }
    | { kind: "exchange-failed"; message: string }
    | { kind: "submitting" }
    | { kind: "sent"; email: string }
    | { kind: "send-failed"; message: string }
  >({ kind: "idle" });
  const [email, setEmail] = useState("");
  const [callerEmail, setCallerEmail] = useState<string | null>(null);

  // Exchange a Supabase callback code if one is present in the URL.
  useEffect(() => {
    const url = new URL(window.location.href);
    const incomingCode = url.searchParams.get("code");
    if (!incomingCode) return;
    let cancelled = false;
    (async () => {
      setStatus({ kind: "exchanging" });
      try {
        const supabase = getSupabase();
        const { error } =
          await supabase.auth.exchangeCodeForSession(incomingCode);
        if (cancelled) return;
        if (error) {
          setStatus({
            kind: "exchange-failed",
            message: error.message || "Sign-in link is invalid or expired.",
          });
          return;
        }
        // Drop the code from the URL so a refresh doesn't try to
        // re-exchange the already-consumed code, then hard-reload so
        // the server component re-runs with the new cookies.
        url.searchParams.delete("code");
        window.history.replaceState({}, "", url.toString());
        window.location.reload();
      } catch (err) {
        if (cancelled) return;
        setStatus({
          kind: "exchange-failed",
          message: err instanceof Error ? err.message : "Sign-in failed.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getSupabase]);

  // If the visitor is already signed in, read back their email so we
  // can render "Signed in as <email> — but not on the allowlist."
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        setCallerEmail(data.user?.email ?? null);
      } catch {
        // best-effort — gate renders fine without the email
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getSupabase]);

  const handleSendLink = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !trimmed.includes("@")) {
        setStatus({
          kind: "send-failed",
          message: "Enter a valid email address.",
        });
        return;
      }
      setStatus({ kind: "submitting" });
      try {
        const supabase = getSupabase();
        const redirectTo = `${window.location.origin}/s/${code}`;
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmed,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
        });
        if (error) {
          // Supabase returns a generic "Signups not allowed" for unknown
          // emails when `shouldCreateUser: false` — rewrite that into
          // something actionable so users know they need to install
          // Trail + sign up first.
          const friendlyMessage = /signups\s+not\s+allowed/i.test(error.message)
            ? "We couldn't find a Trail account for that email. Install the Trail extension and sign up first — then come back and try this link."
            : error.message || "Couldn't send the sign-in link.";
          setStatus({
            kind: "send-failed",
            message: friendlyMessage,
          });
          return;
        }
        setStatus({ kind: "sent", email: trimmed });
      } catch (err) {
        setStatus({
          kind: "send-failed",
          message: err instanceof Error ? err.message : "Send failed.",
        });
      }
    },
    [email, code, getSupabase],
  );

  const handleSignOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut().catch(() => undefined);
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

        {status.kind === "exchanging" ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Verifying your sign-in link...
          </p>
        ) : null}

        {status.kind === "exchange-failed" ? (
          <p className="mt-6 text-sm text-destructive">{status.message}</p>
        ) : null}

        {authenticated && status.kind !== "exchanging" ? (
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
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void handleSignOut()}>
                Sign in with a different email
              </Button>
            </div>
          </div>
        ) : null}

        {!authenticated && status.kind !== "exchanging" ? (
          <form className="mt-6 flex flex-col gap-3" onSubmit={handleSendLink}>
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
            <Button
              type="submit"
              disabled={status.kind === "submitting" || status.kind === "sent"}
            >
              {status.kind === "submitting"
                ? "Sending..."
                : status.kind === "sent"
                  ? "Link sent"
                  : "Send sign-in link"}
            </Button>
            {status.kind === "send-failed" ? (
              <p className="text-sm text-destructive">{status.message}</p>
            ) : null}
            {status.kind === "sent" ? (
              <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                Sent to <strong>{status.email}</strong>. Open the email and
                click the link to view this trail. You can close this tab.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Don&apos;t have an account yet? The link works only for emails the
              share owner has added. Ask them to invite you.
            </p>
          </form>
        ) : null}
      </div>
    </main>
  );
}
