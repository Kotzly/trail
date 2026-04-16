import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import { Button } from "@ui/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/ui/avatar";
import { Skeleton } from "@ui/components/ui/skeleton";
import {
  initAuth,
  signInWithGoogle,
  signOut,
  subscribeAuthState,
  type AuthState,
} from "@shared/auth/auth-orchestrator.js";
import { isSupabaseConfigured } from "@shared/lib/supabase.js";
import { captureError } from "@shared/lib/observability.js";

export function AccountPage() {
  const [state, setState] = useState<AuthState>({ status: "signed-out" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void initAuth().then((s) => {
      if (active) {
        setState(s);
        setLoading(false);
      }
    });
    const unsub = subscribeAuthState((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const handleSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      captureError(err, { kind: "ui_signin" });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
    } catch (err) {
      captureError(err, { kind: "ui_signout" });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Account</h2>
          <p className="text-muted-foreground text-sm">
            Cloud sync is not configured in this build.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Account</h2>
        <p className="text-muted-foreground text-sm">
          Sign in to sync your trees across devices. Your data stays on your device until you
          explicitly sign in.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trail account</CardTitle>
          <CardDescription>
            Authentication is handled by Supabase — no password is stored in the extension.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : state.status === "signed-in" ? (
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                {state.identity.avatarUrl ? (
                  <AvatarImage src={state.identity.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback>
                  {(state.identity.displayName ?? state.identity.email ?? "?")
                    .slice(0, 1)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {state.identity.displayName ?? "Signed in"}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {state.identity.email ?? state.identity.userId}
                </span>
              </div>
              <Button variant="outline" size="sm" disabled={busy} onClick={handleSignOut}>
                {busy ? "Signing out…" : "Sign out"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground text-sm">
                You're not signed in. Your trees are stored locally only.
              </p>
              <Button onClick={handleSignIn} disabled={busy}>
                {busy ? "Opening sign-in…" : "Sign in with Google"}
              </Button>
              {error ? (
                <p className="text-destructive text-xs">{error}</p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  A secure popup opens. We never see your password.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
