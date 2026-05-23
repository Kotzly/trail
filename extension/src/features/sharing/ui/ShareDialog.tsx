import { useCallback, useEffect, useState } from "react";
import { Button } from "@ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/components/ui/dialog";
import { Input } from "@ui/components/ui/input";
import { Switch } from "@ui/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { Spinner } from "@ui/components/ui/spinner";
import { toast } from "sonner";
import { Icons } from "@ui/components/icons";
import { treeService } from "@shared/transport/proxy-clients.js";
import { useAuthState } from "@shared/auth/use-auth-state.js";
import {
  buildShareUrl,
  createShareLink,
  listMyShareLinks,
  revokeShareLink,
  type ShareLinkRow,
} from "../share-api.js";

type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treeId: string;
  treeLabel: string;
  /**
   * Called after a successful create or revoke. Lets surfaces with a
   * cross-trail share list refresh themselves without reaching into the
   * dialog's state.
   */
  onSharesChanged?: () => void;
};

type DialogStatus =
  | { kind: "loading" }
  | { kind: "ready"; share: ShareLinkRow | null }
  | { kind: "error"; message: string };

/**
 * Map an `ensureTreePushed` outcome to a user-facing error message.
 * Returns null for outcomes the caller should treat as "proceed".
 *
 * The dialog gates the call on `signedIn`, so when `"skipped"` reaches
 * us the user IS signed in — it actually means the active tree is
 * empty or a conflict merge is in flight (see `doPushActive` /
 * `doPushStored` for the underlying branches). Don't claim "sign in"
 * here; surface a truthful "couldn't prepare" message instead.
 */
function describePushFailure(outcome: string): string | null {
  switch (outcome) {
    case "ok":
      return null;
    case "skipped":
      // Empty trail (no root) or merge in flight. The dialog already
      // gates on `signedIn`, so the auth-skipped branch in
      // `doPushActive` is unreachable here.
      return "This trail can't be shared yet — add at least one page, or wait for an ongoing sync to finish.";
    case "offline":
      return "You're offline. Reconnect and try again.";
    case "conflict":
      return "Another device edited this trail. Resolve the conflict before sharing.";
    case "rate_limited":
      return "Too many syncs just now. Wait about a minute and try again.";
    default:
      return "Couldn't sync this trail to the cloud. Check your connection and try again.";
  }
}

/**
 * Share dialog for the trail-link feature. Shows the toggle "Available
 * to anyone with your link" (active), a disabled "Only select users
 * (Coming soon)" affordance, and — when sharing is on — the URL with a
 * copy button plus a "Stop sharing" action that explicitly tells the
 * user "people who already imported keep their copy".
 *
 * Source of truth for the toggle: the existence of a non-revoked row
 * in `shared_trail_links` for this trail. The dialog reloads the
 * server state on open so multi-device users see a consistent picture.
 *
 * Surface-agnostic: talks to `treeService` directly so both the sidepanel
 * and the Settings → Trees page can mount the same component.
 */
export function ShareDialog({
  open,
  onOpenChange,
  treeId,
  treeLabel,
  onSharesChanged,
}: ShareDialogProps) {
  const authState = useAuthState();
  const signedIn = authState.status === "signed-in";
  const [status, setStatus] = useState<DialogStatus>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  // Reload share state every time the dialog opens for this trail.
  // Defers the RPC until the user is known to be signed in — calling
  // list_my_share_links as `anon` fails with "permission denied".
  useEffect(() => {
    if (!open) return;
    if (!signedIn) {
      setStatus({
        kind: "error",
        message: "Sign in to share trails.",
      });
      return;
    }
    setStatus({ kind: "loading" });
    setConfirmRevoke(false);
    let cancelled = false;
    (async () => {
      try {
        const rows = await listMyShareLinks();
        if (cancelled) return;
        const active = rows.find((r) => r.trail_id === treeId && r.revoked_at === null) ?? null;
        setStatus({ kind: "ready", share: active });
      } catch (err) {
        if (cancelled) return;
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to load share state",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, treeId, signedIn]);

  const handleEnableShare = useCallback(async () => {
    setBusy(true);
    try {
      // Ensure the trail row exists server-side before minting the
      // share. Without this, brand-new local trails fail the RPC's
      // owner check with `share_create_not_owner` ("tree doesn't
      // exist" from the caller's perspective).
      const pushOutcome = await treeService.ensureTreePushed({ treeId });
      const pushError = describePushFailure(pushOutcome);
      if (pushError) {
        toast.error(pushError);
        return;
      }
      const bundle = await treeService.exportTree({ treeId });
      const result = await createShareLink(treeId, bundle.tree);
      const row: ShareLinkRow = {
        code: result.code,
        trail_id: treeId,
        label: result.label,
        root_url: null,
        root_title: null,
        node_count: bundle.meta.nodeCount,
        created_at: result.createdAt,
        revoked_at: null,
        view_count: 0,
      };
      setStatus({ kind: "ready", share: row });
      onSharesChanged?.();
      toast.success("Trail is now shared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create share link");
    } finally {
      setBusy(false);
    }
  }, [treeId, onSharesChanged]);

  const handleRevokeShare = useCallback(
    async (code: string) => {
      setBusy(true);
      try {
        await revokeShareLink(code);
        setStatus({ kind: "ready", share: null });
        setConfirmRevoke(false);
        onSharesChanged?.();
        toast.success("Share link revoked");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to revoke share link");
      } finally {
        setBusy(false);
      }
    },
    [onSharesChanged],
  );

  const handleToggle = useCallback(
    (next: boolean) => {
      if (status.kind !== "ready" || busy) return;
      if (next && !status.share) {
        void handleEnableShare();
      } else if (!next && status.share) {
        setConfirmRevoke(true);
      }
    },
    [busy, handleEnableShare, status],
  );

  const handleCopy = useCallback(async (code: string) => {
    const url = buildShareUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  }, []);

  const sharing = status.kind === "ready" && status.share !== null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share "{treeLabel}"</DialogTitle>
            <DialogDescription>
              Create a public link to this trail. The shared snapshot is frozen at the moment you
              turn sharing on.
            </DialogDescription>
          </DialogHeader>

          {status.kind === "loading" ? (
            <div className="flex items-center justify-center py-6">
              <Spinner className="size-5" />
            </div>
          ) : status.kind === "error" ? (
            <p className="text-destructive text-sm">{status.message}</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <label htmlFor="share-public-toggle" className="block text-sm font-medium">
                    Available to anyone with your link
                  </label>
                  <p className="text-muted-foreground text-xs">
                    Anyone with the URL can view a read-only copy of this trail.
                  </p>
                </div>
                <Switch
                  id="share-public-toggle"
                  checked={sharing}
                  disabled={busy}
                  onCheckedChange={handleToggle}
                />
              </div>

              {sharing && status.share ? (
                <div className="bg-muted/40 space-y-2 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Icons.Link className="text-muted-foreground size-4 shrink-0" />
                    <Input
                      readOnly
                      value={buildShareUrl(status.share.code)}
                      className="flex-1 bg-transparent font-mono text-xs"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleCopy(status.share!.code)}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    {status.share.view_count} {status.share.view_count === 1 ? "view" : "views"} ·{" "}
                    {status.share.node_count} {status.share.node_count === 1 ? "node" : "nodes"}
                  </p>
                </div>
              ) : null}

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-not-allowed opacity-50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">Only select users</p>
                        <p className="text-muted-foreground text-xs">Share with specific emails.</p>
                      </div>
                      <Switch checked={false} disabled />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>Coming soon</TooltipContent>
              </Tooltip>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stop-sharing confirmation */}
      <Dialog
        open={confirmRevoke}
        onOpenChange={(next) => {
          if (busy) return;
          setConfirmRevoke(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stop sharing this trail?</DialogTitle>
            <DialogDescription>
              Anyone with the link loses access. People who already imported keep their copy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirmRevoke(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (status.kind === "ready" && status.share) {
                  void handleRevokeShare(status.share.code);
                }
              }}
            >
              Stop sharing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
