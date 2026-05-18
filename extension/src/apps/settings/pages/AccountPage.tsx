import { useState } from "react";
import { i18n } from "#i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import { PageHeader, SectionHeader } from "../components/PageHeader.js";
import { Button } from "@ui/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@ui/components/ui/alert";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Badge } from "@ui/components/ui/badge";
import { Input } from "@ui/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@ui/components/ui/field";
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
import type { AuthProvider } from "@shared/config/storage-items.js";
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
      <div className="flex flex-col gap-10">
        <PageHeader
          title={i18n.t("account.title")}
          description={i18n.t("account.descriptionCloudOff")}
        />
        <Alert>
          <Icons.Info aria-hidden />
          <AlertTitle>{i18n.t("account.localOnlyAlertTitle")}</AlertTitle>
          <AlertDescription>
            {i18n.t("account.localOnlyAlertBodyPrefix")} <code>chrome.storage.local</code>{" "}
            {i18n.t("account.localOnlyAlertBodySuffix")}
          </AlertDescription>
        </Alert>
        <DangerZoneCard signedIn={false} />
      </div>
    );
  }

  const signedIn = state.status === "signed-in";

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={i18n.t("account.title")}
        description={i18n.t("account.descriptionCloudOn")}
      />

      <ProfileSection
        loading={loading}
        state={state}
        busy={busy}
        error={error}
        onSignOut={handleSignOut}
        onOpenLogin={openLoginTab}
      />

      {signedIn ? <SyncSection /> : null}

      {signedIn && state.status === "signed-in" && state.identity.provider === "email" ? (
        <SecuritySection />
      ) : null}

      <DangerZoneCard signedIn={signedIn} />
    </div>
  );
}

/* ─── Profile section ────────────────────────────────────────── */

type ProfileSectionProps = {
  loading: boolean;
  state: AuthState;
  busy: boolean;
  error: string | null;
  onSignOut: () => void;
  onOpenLogin: () => void;
};

function ProfileSection({
  loading,
  state,
  busy,
  error,
  onSignOut,
  onOpenLogin,
}: ProfileSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader eyebrow={i18n.t("account.cardTitle")} />
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
            <span className="truncate text-sm">
              {state.identity.displayName ?? i18n.t("account.signedInFallback")}
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {state.identity.email ?? state.identity.userId}
            </span>
          </div>
          <ProviderBadge provider={state.identity.provider} />
          <Button variant="outline" size="sm" disabled={busy} onClick={onSignOut}>
            {busy ? i18n.t("account.signingOut") : i18n.t("account.signOut")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground text-sm">{i18n.t("account.notSignedInBody")}</p>
          <Button onClick={onOpenLogin}>
            <Icons.ExternalLink data-icon="inline-start" />
            {i18n.t("account.openSignIn")}
          </Button>
        </div>
      )}
      {error ? (
        <Alert variant="destructive">
          <Icons.AlertTriangle aria-hidden />
          <AlertTitle>{i18n.t("account.signOutFailed")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}

/* ─── Provider badge ─────────────────────────────────────────── */

function ProviderBadge({ provider }: { provider: AuthProvider }) {
  if (provider === "google") {
    return <Badge variant="secondary">{i18n.t("account.provider.google")}</Badge>;
  }
  if (provider === "github") {
    return <Badge variant="secondary">{i18n.t("account.provider.github")}</Badge>;
  }
  if (provider === "email") {
    return <Badge variant="secondary">{i18n.t("account.provider.email")}</Badge>;
  }
  return null;
}

/* ─── Sync summary section ───────────────────────────────────── */

function SyncSection() {
  const summary = useSyncSummary();

  const statusLabel = {
    idle: i18n.t("account.sync.status.idle"),
    saving: i18n.t("account.sync.status.saving"),
    saved: i18n.t("account.sync.status.saved"),
    error: i18n.t("account.sync.status.error"),
    offline: i18n.t("account.sync.status.offline"),
  }[summary.status];

  const statusVariant: "default" | "secondary" | "destructive" =
    summary.status === "error"
      ? "destructive"
      : summary.status === "offline"
        ? "secondary"
        : "default";

  const lastSynced = summary.lastSyncedAt ? new Date(summary.lastSyncedAt) : null;

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader eyebrow={i18n.t("account.sync.title")} />
      <dl className="divide-border divide-y">
        <SyncRow label={i18n.t("account.sync.statusLabel")}>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </SyncRow>
        <SyncRow label={i18n.t("account.sync.treesSynced")}>
          <span className="text-sm tabular-nums">{summary.syncedTreeCount}</span>
        </SyncRow>
        <SyncRow label={i18n.t("account.sync.pending")}>
          <span className="text-sm tabular-nums">{summary.pendingOpCount}</span>
        </SyncRow>
        <SyncRow label={i18n.t("account.sync.lastSync")}>
          {lastSynced ? (
            <time
              className="text-muted-foreground text-sm tabular-nums"
              dateTime={lastSynced.toISOString()}
              title={lastSynced.toLocaleString()}
            >
              {formatRelative(summary.lastSyncedAt!)}
            </time>
          ) : (
            <span className="text-muted-foreground text-sm">{i18n.t("account.sync.dash")}</span>
          )}
        </SyncRow>
      </dl>
    </section>
  );
}

function SyncRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return i18n.t("trees.relative.justNow");
  if (diff < 3_600_000)
    return i18n.t("trees.relative.minutesAgo", [String(Math.floor(diff / 60_000))]);
  if (diff < 86_400_000)
    return i18n.t("trees.relative.hoursAgo", [String(Math.floor(diff / 3_600_000))]);
  return i18n.t("trees.relative.daysAgo", [String(Math.floor(diff / 86_400_000))]);
}

/* ─── Security (change password) ─────────────────────────────── */

function SecuritySection() {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, submittingActions] = useBoolean(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = useLockFn(async () => {
    setLocalError(null);
    const err = validatePassword(next);
    if (err) return setLocalError(err);
    if (next !== confirm) return setLocalError(i18n.t("account.security.passwordsMismatch"));
    submittingActions.setTrue();
    try {
      await updatePassword(next);
      toast.success(i18n.t("account.security.passwordUpdated"));
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
    <section className="flex flex-col gap-3">
      <SectionHeader
        eyebrow={i18n.t("account.security.title")}
        description={i18n.t("account.security.sectionDescription")}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="self-start">
            {i18n.t("account.security.changePassword")}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{i18n.t("account.security.changePassword")}</DialogTitle>
            <DialogDescription>{i18n.t("account.security.dialogDescription")}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-password">
                  {i18n.t("account.security.newPassword")}
                </FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  disabled={submitting}
                />
                <p className="text-muted-foreground text-xs">
                  {i18n.t("account.security.passwordHint")}
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">
                  {i18n.t("account.security.confirmPassword")}
                </FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={submitting}
                />
              </Field>
            </FieldGroup>
            {localError ? (
              <Alert variant="destructive">
                <Icons.AlertTriangle aria-hidden />
                <AlertDescription>{localError}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {i18n.t("account.security.cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? i18n.t("account.security.updating")
                  : i18n.t("account.security.updatePassword")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* ─── Danger zone ────────────────────────────────────────────── */

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
      toast.success(i18n.t("account.danger.toast.cleared"));
    } catch (error) {
      captureError(error, { kind: "ui_clear_local" });
      toast.error(i18n.t("account.danger.toast.clearFailed"), { description: String(error) });
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
          throw rpcResult.error;
        }
      }
      await signOut();
      await browser.storage.local.clear();
      await browser.storage.session?.clear().catch(() => {});
      captureEvent("auth_signout", { reason: "account_deletion" });
      toast.success(i18n.t("account.danger.toast.deletionRequested"), {
        description: i18n.t("account.danger.toast.deletionBody"),
        duration: 8000,
      });
    } catch (error) {
      captureError(error, { kind: "ui_delete_account" });
      toast.error(i18n.t("account.danger.toast.deleteFailed"), { description: String(error) });
    } finally {
      deletingActions.setFalse();
    }
  });

  return (
    <Card className="border-destructive/30 bg-destructive/[0.02]">
      <CardHeader>
        <CardTitle className="text-destructive text-base">
          {i18n.t("account.danger.title")}
        </CardTitle>
        <CardDescription>{i18n.t("account.danger.description")}</CardDescription>
      </CardHeader>
      <CardContent className="divide-border flex flex-col divide-y">
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm">{i18n.t("account.danger.clearLocal.name")}</span>
            <span className="text-muted-foreground text-xs leading-relaxed">
              {i18n.t("account.danger.clearLocal.description")}
            </span>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={clearing} className="shrink-0">
                {i18n.t("account.danger.clearLocal.button")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {i18n.t("account.danger.clearLocal.confirmTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {i18n.t("account.danger.clearLocal.confirmBody")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{i18n.t("account.danger.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={() => void clearLocal()}>
                  {i18n.t("account.danger.clearLocal.button")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {signedIn ? (
          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-destructive text-sm">
                {i18n.t("account.danger.delete.name")}
              </span>
              <span className="text-muted-foreground text-xs leading-relaxed">
                {i18n.t("account.danger.delete.description")}
              </span>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting} className="shrink-0">
                  {i18n.t("account.danger.delete.button")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {i18n.t("account.danger.delete.confirmTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {i18n.t("account.danger.delete.confirmBody")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{i18n.t("account.danger.cancel")}</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => void deleteAccount()}>
                    {i18n.t("account.danger.delete.confirmAction")}
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
