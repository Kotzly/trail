import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import { PageHeader } from "../components/PageHeader.js";
import { Button } from "@ui/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@ui/components/ui/alert";
import { Skeleton } from "@ui/components/ui/skeleton";
import { useBoolean } from "@ui/hooks/use-boolean";
import { useLockFn } from "@ui/hooks/use-lock-fn";
import { useMount } from "@ui/hooks/use-mount";
import { Icons } from "@ui/components/icons";
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
  const [loading, loadingActions] = useBoolean(true);
  const [busy, busyActions] = useBoolean(false);
  const [error, setError] = useState<string | null>(null);

  useMount(() => {
    let active = true;
    void initAuth().then((s) => {
      if (active) {
        setState(s);
        loadingActions.setFalse();
      }
    });
    const unsub = subscribeAuthState((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
      unsub();
    };
  });

  const handleSignIn = useLockFn(async () => {
    busyActions.setTrue();
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      captureError(err, { kind: "ui_signin" });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      busyActions.setFalse();
    }
  });

  const handleSignOut = useLockFn(async () => {
    busyActions.setTrue();
    try {
      await signOut();
    } catch (err) {
      captureError(err, { kind: "ui_signout" });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      busyActions.setFalse();
    }
  });

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Account" description="Cloud sync is not configured in this build." />
        <Alert>
          <Icons.Info aria-hidden />
          <AlertTitle>Local-only mode</AlertTitle>
          <AlertDescription>
            This build of Trail has no Supabase credentials baked in, so cloud sync, sign-in, and
            cross-device support are turned off. Everything still works locally — your trees live in{" "}
            <code>chrome.storage.local</code> on this profile.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Account"
        description="Sign in to sync your trees across devices. Your data stays on your device until you explicitly sign in."
      />

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
              <Button onClick={handleSignIn} disabled={busy} className="self-start">
                {busy ? "Opening sign-in…" : "Sign in with Google"}
              </Button>
              {error ? (
                <Alert variant="destructive">
                  <Icons.AlertTriangle aria-hidden />
                  <AlertTitle>Sign-in failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
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
