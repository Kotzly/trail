import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Spinner } from "@ui/components/ui/spinner";
import { toast } from "sonner";
import { Icons } from "@ui/components/icons";
import { treeService } from "@shared/transport/proxy-clients.js";
import { useAuthState } from "@shared/auth/use-auth-state.js";
import {
  buildShareUrl,
  createShareLink,
  listMyShareLinks,
  listShareAcl,
  revokeShareLink,
  setShareAcl,
  setShareVisibility,
  type ShareLinkRow,
  type ShareVisibility,
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

const MAX_ACL_ENTRIES = 100;

/**
 * Map an `ensureTreePushed` outcome to a user-facing error message.
 * Returns null for outcomes the caller should treat as "proceed".
 */
function describePushFailure(outcome: string): string | null {
  switch (outcome) {
    case "ok":
      return null;
    case "skipped":
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
 * Share dialog for the trail-link feature. Toggles:
 *   * Master "Available with link" switch — creates / revokes the share.
 *   * "Only invited emails" switch — flips visibility between public
 *     and restricted, revealing an email allowlist editor.
 *
 * Source of truth: existence + visibility + ACL of the row in
 * `shared_trail_links` for this trail. Reloads on open so multi-device
 * users see a consistent picture. ACL writes happen via
 * `set_share_acl(code, emails[])` which atomically replaces the list.
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

  // ACL editing state — kept separate from `status.share` because the
  // user can edit the textarea without immediately committing.
  const [aclEntries, setAclEntries] = useState<string[]>([]);
  const [aclDraft, setAclDraft] = useState("");
  const [aclDirty, setAclDirty] = useState(false);
  const [aclSaving, setAclSaving] = useState(false);

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
    setAclEntries([]);
    setAclDraft("");
    setAclDirty(false);
    let cancelled = false;
    (async () => {
      try {
        const rows = await listMyShareLinks();
        if (cancelled) return;
        const active = rows.find((r) => r.trail_id === treeId && r.revoked_at === null) ?? null;
        setStatus({ kind: "ready", share: active });
        if (active && active.visibility === "restricted") {
          const acl = await listShareAcl(active.code);
          if (cancelled) return;
          const emails = acl.map((e) => e.email);
          setAclEntries(emails);
          setAclDraft(emails.join("\n"));
        }
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
        visibility: "public",
        acl_count: 0,
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
        setAclEntries([]);
        setAclDraft("");
        setAclDirty(false);
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

  const handleVisibilityToggle = useCallback(
    async (restricted: boolean) => {
      if (status.kind !== "ready" || !status.share || busy) return;
      const next: ShareVisibility = restricted ? "restricted" : "public";
      const code = status.share.code;
      setBusy(true);
      try {
        await setShareVisibility(code, next);
        setStatus({
          kind: "ready",
          share: { ...status.share, visibility: next },
        });
        if (next === "public") {
          // Server keeps the ACL rows so flipping back doesn't lose them,
          // but they're inactive while public.
          toast.success("Now visible to anyone with the link");
        } else {
          toast.success("Now visible only to invited emails");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to change visibility");
      } finally {
        setBusy(false);
      }
    },
    [busy, status],
  );

  const handleAclSave = useCallback(async () => {
    if (status.kind !== "ready" || !status.share) return;
    const parsed = parseEmails(aclDraft);
    if (parsed.length > MAX_ACL_ENTRIES) {
      toast.error(`At most ${MAX_ACL_ENTRIES} emails per share.`);
      return;
    }
    setAclSaving(true);
    try {
      const accepted = await setShareAcl(status.share.code, parsed);
      setAclEntries(parsed);
      setAclDraft(parsed.join("\n"));
      setAclDirty(false);
      setStatus({
        kind: "ready",
        share: { ...status.share, acl_count: accepted },
      });
      toast.success(`Allowlist updated · ${accepted} ${accepted === 1 ? "email" : "emails"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update allowlist");
    } finally {
      setAclSaving(false);
    }
  }, [status, aclDraft]);

  const sharing = status.kind === "ready" && status.share !== null;
  const restricted = sharing && status.share?.visibility === "restricted";
  const aclEntryCount = useMemo(() => parseEmails(aclDraft).length, [aclDraft]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share &ldquo;{treeLabel}&rdquo;</DialogTitle>
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
                    Available with link
                  </label>
                  <p className="text-muted-foreground text-xs">
                    {restricted
                      ? "Only invited emails can view this trail."
                      : "Anyone with the URL can view a read-only copy of this trail."}
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
                    {restricted ? (
                      <>
                        {" · "}
                        {status.share.acl_count}{" "}
                        {status.share.acl_count === 1 ? "invitee" : "invitees"}
                      </>
                    ) : null}
                  </p>
                </div>
              ) : null}

              {sharing ? (
                <div className="flex items-center justify-between gap-3 border-t pt-4">
                  <div className="flex-1">
                    <label htmlFor="share-restricted-toggle" className="block text-sm font-medium">
                      Only invited emails
                    </label>
                    <p className="text-muted-foreground text-xs">
                      Viewers sign in with their email; only addresses you add below can open the
                      trail.
                    </p>
                  </div>
                  <Switch
                    id="share-restricted-toggle"
                    checked={Boolean(restricted)}
                    disabled={busy}
                    onCheckedChange={(next) => void handleVisibilityToggle(next)}
                  />
                </div>
              ) : null}

              {sharing && restricted ? (
                <div className="space-y-2">
                  <label htmlFor="share-acl-emails" className="block text-sm font-medium">
                    Allowlist
                  </label>
                  <textarea
                    id="share-acl-emails"
                    className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring/50 flex min-h-[96px] w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                    placeholder={"alice@example.com\nbob@example.com"}
                    value={aclDraft}
                    onChange={(e) => {
                      setAclDraft(e.target.value);
                      setAclDirty(true);
                    }}
                    disabled={aclSaving}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-xs">
                      {aclEntryCount}/{MAX_ACL_ENTRIES} emails · one per line
                    </p>
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => void handleAclSave()}
                      disabled={aclSaving || !aclDirty}
                    >
                      {aclSaving ? "Saving..." : "Save allowlist"}
                    </Button>
                  </div>
                  {aclEntries.length === 0 ? (
                    <p className="text-muted-foreground bg-muted/40 rounded-md border px-3 py-2 text-xs">
                      No one can view this trail yet. Add at least one email and save.
                    </p>
                  ) : null}
                </div>
              ) : null}
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

/**
 * Normalize a free-form textarea into a deduped, lowercased,
 * @-containing list. Mirrors the server-side filter in `set_share_acl`
 * so the count we show matches what will actually persist.
 */
function parseEmails(raw: string): string[] {
  const out = new Set<string>();
  for (const line of raw.split(/[\s,;]+/)) {
    const t = line.trim().toLowerCase();
    if (t && t.includes("@") && !t.startsWith("@")) out.add(t);
  }
  return Array.from(out).sort();
}
