import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import { PageHeader } from "../components/PageHeader.js";
import { Button } from "@ui/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@ui/components/ui/alert";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Badge } from "@ui/components/ui/badge";
import { Input } from "@ui/components/ui/input";
import { Label } from "@ui/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ui/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui/components/ui/alert-dialog";
import { useBoolean } from "@ui/hooks/use-boolean";
import { useLockFn } from "@ui/hooks/use-lock-fn";
import { useMount } from "@ui/hooks/use-mount";
import { Icons } from "@ui/components/icons";
import { toast } from "sonner";
import {
  initAuth,
  signOut,
  subscribeAuthState,
  updatePassword,
  validatePassword,
  type AuthState,
} from "@shared/auth/auth-orchestrator.js";
import { getSupabaseClient, isSupabaseConfigured } from "@shared/lib/supabase.js";
import { captureError, captureEvent } from "@shared/lib/observability.js";
import { browser } from "@shared/platform/webext.js";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncSummary } from "../hooks/useSyncSummary.js";
import { resetTreeData } from "../api.js";

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

  const handleSignOut = useLockFn(async () => {
    busyActions.setTrue();
    setError(null);
    try {
      await signOut();
    } catch (err) {
      captureError(err, { kind: "ui_signout" });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      busyActions.setFalse();
    }
  });

  const openLoginTab = () => {
    const url = chrome.runtime.getURL("/login.html");
    void chrome.tabs.create({ url });
  };

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
        <DangerZoneCard signedIn={false} />
      </div>
    );
  }

  const signedIn = state.status === "signed-in";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Account"
        description="Sign in to sync your trees across devices. Your data stays on your device until you explicitly sign in."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trail account</CardTitle>
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
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium">
                  {state.identity.displayName ?? "Signed in"}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {state.identity.email ?? state.identity.userId}
                </span>
              </div>
              <ProviderBadge provider={state.identity.provider} />
              <Button variant="outline" size="sm" disabled={busy} onClick={handleSignOut}>
                {busy ? "Signing out…" : "Sign out"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted-foreground text-sm">
                You're not signed in. Your trees are stored locally only. We never see your password
                — it's hashed before it leaves your device.
              </p>
              <Button onClick={openLoginTab}>
                <Icons.ExternalLink data-icon="inline-start" />
                Open sign-in
              </Button>
            </div>
          )}
          {error ? (
            <Alert variant="destructive" className="mt-4">
              <Icons.AlertTriangle aria-hidden />
              <AlertTitle>Sign-out failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {signedIn ? <SyncSummaryCard /> : null}

      {signedIn && state.status === "signed-in" && state.identity.provider === "email" ? (
        <SecurityCard />
      ) : null}

      <DangerZoneCard signedIn={signedIn} />
    </div>
  );
}

/* ─── Provider badge ─────────────────────────────────────────── */

function ProviderBadge({ provider }: { provider: "email" | "google" | "other" }) {
  if (provider === "google") {
    return <Badge variant="secondary">Google</Badge>;
  }
  if (provider === "email") {
    return <Badge variant="secondary">Email</Badge>;
  }
  return null;
}

/* ─── Sync summary card ──────────────────────────────────────── */

function SyncSummaryCard() {
  const summary = useSyncSummary();

  const statusLabel = {
    idle: "Up to date",
    saving: "Syncing…",
    saved: "Up to date",
    error: "Sync error",
    offline: "Offline",
  }[summary.status];

  const statusVariant: "default" | "secondary" | "destructive" =
    summary.status === "error"
      ? "destructive"
      : summary.status === "offline"
        ? "secondary"
        : "default";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sync</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Status</span>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Trees synced</span>
          <span className="text-sm tabular-nums">{summary.syncedTreeCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Pending</span>
          <span className="text-sm tabular-nums">{summary.pendingOpCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Last sync</span>
          <span className="text-muted-foreground text-sm">
            {summary.lastSyncedAt ? formatRelative(summary.lastSyncedAt) : "—"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/* ─── Security (change password) ─────────────────────────────── */

function SecurityCard() {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, submittingActions] = useBoolean(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = useLockFn(async () => {
    setLocalError(null);
    const err = validatePassword(next);
    if (err) return setLocalError(err);
    if (next !== confirm) return setLocalError("Passwords don't match.");
    submittingActions.setTrue();
    try {
      await updatePassword(next);
      toast.success("Password updated.");
      setOpen(false);
      setNext("");
      setConfirm("");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLocalError(message);
      captureError(err, { kind: "ui_change_password" });
    } finally {
      submittingActions.setFalse();
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Security</CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Change password</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change password</DialogTitle>
              <DialogDescription>
                Choose a new password. You'll stay signed in on this device.
              </DialogDescription>
            </DialogHeader>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={submitting}
                />
              </div>
              {localError ? (
                <Alert variant="destructive">
                  <Icons.AlertTriangle aria-hidden />
                  <AlertDescription>{localError}</AlertDescription>
                </Alert>
              ) : null}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Updating…" : "Update password"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* ─── Danger zone (moved from DataPage) ──────────────────────── */

function DangerZoneCard({ signedIn }: { signedIn: boolean }) {
  const [clearing, clearingActions] = useBoolean(false);
  const [deleting, deletingActions] = useBoolean(false);
  const queryClient = useQueryClient();

  const clearLocal = useLockFn(async () => {
    clearingActions.setTrue();
    try {
      // Route through the background so in-memory caches (tree
      // index, tab manager, command history) are reset in the same
      // transaction as the storage wipe. A bare
      // `browser.storage.local.clear()` only touched persisted
      // state; the background kept serving stale trees from its
      // own caches until it got evicted.
      await resetTreeData();
      await queryClient.invalidateQueries({ queryKey: ["trees"] });
      captureEvent("tree_exported", { kind: "clear_local" });
      toast.success("Local trees cleared. Your browser tabs are untouched.");
    } catch (error) {
      captureError(error, { kind: "ui_clear_local" });
      toast.error("Failed to clear local data", { description: String(error) });
    } finally {
      clearingActions.setFalse();
    }
  });

  const deleteAccount = useLockFn(async () => {
    deletingActions.setTrue();
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const rpcResult = await supabase.rpc("request_account_deletion");
        if (rpcResult.error) {
          await supabase
            .from("trails")
            .update({ deleted_at: new Date().toISOString() })
            .neq("id", "00000000-0000-0000-0000-000000000000");
        }
      }
      await signOut();
      await browser.storage.local.clear();
      await browser.storage.session?.clear().catch(() => {});
      captureEvent("auth_signout", { reason: "account_deletion" });
      toast.success("Account deletion requested", {
        description:
          "Your local data has been cleared and your session ended. " +
          "Server-side data removal completes within 30 days.",
        duration: 8000,
      });
    } catch (error) {
      captureError(error, { kind: "ui_delete_account" });
      toast.error("Failed to request account deletion", { description: String(error) });
    } finally {
      deletingActions.setFalse();
    }
  });

  return (
    <Card className="border-destructive/30 bg-destructive/[0.02]">
      <CardHeader>
        <CardTitle className="text-destructive text-base">Danger zone</CardTitle>
        <CardDescription>
          These actions are irreversible. Read each description carefully before you confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-border flex flex-col divide-y">
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium">Clear local data</span>
            <span className="text-muted-foreground text-xs leading-relaxed">
              Wipes every tree and tree-related state on this profile (sync queue, undo history, tab
              restoration). Sign-in, settings, and open browser tabs stay. Cloud data is not touched
              — signed-in users will see their cloud trees reappear as cloud-only entries after the
              next sync.
            </span>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={clearing} className="shrink-0">
                Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all local trees?</AlertDialogTitle>
                <AlertDialogDescription>
                  Wipes every tree and tree-related state on this profile. Sign-in, settings, and
                  open browser tabs stay. Cloud data is untouched.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void clearLocal()}>Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {signedIn ? (
          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-destructive text-sm font-medium">Delete account</span>
              <span className="text-muted-foreground text-xs leading-relaxed">
                Permanently deletes your Trail account and every tree stored in the cloud. Local
                data is cleared right away; server-side removal finishes within 30 days. This cannot
                be undone.
              </span>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting} className="shrink-0">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your Trail account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This requests deletion of your account and all cloud-stored trees. Local data is
                    cleared immediately. Server-side deletion completes within 30 days per our
                    Privacy Policy. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => void deleteAccount()}>
                    Delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
