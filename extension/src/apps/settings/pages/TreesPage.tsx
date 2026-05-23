import { memo, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { storage } from "wxt/utils/storage";
import { i18n } from "#i18n";
import { useTrees } from "../hooks/useTrees.js";
import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@ui/components/ui/field";
import { PageHeader, SectionHeader } from "../components/PageHeader.js";
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
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@ui/components/ui/item";
import { Skeleton } from "@ui/components/ui/skeleton";
import { Spinner } from "@ui/components/ui/spinner";
import { ButtonTooltip } from "@ui/components/button-tooltip";
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
import { Icons } from "@ui/components/icons";
import { isTreeStub, type TreeIndexEntry } from "@shared/types/tree.js";
import {
  syncStateItem,
  pendingSyncOpsItem,
  type SyncStateMeta,
  type PendingSyncOp,
} from "@shared/config/storage-items.js";
import { ShareDialog } from "@features/sharing/ui/ShareDialog.js";
import {
  buildShareUrl,
  listMyShareLinks,
  revokeShareLink,
  type ShareLinkRow,
} from "@features/sharing/share-api.js";
import { useAuthState } from "@shared/auth/use-auth-state.js";

export function TreesPage() {
  const {
    trees,
    loading,
    newTree,
    openTree,
    renameTree,
    deleteTree,
    downloadTree,
    unloadTree,
    downloadPending,
    unloadPending,
    exportTree,
    importFromFile,
  } = useTrees();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const syncMap = useTreeSyncMap();
  const authState = useAuthState();
  const canShare = authState.status === "signed-in";
  const [shareTarget, setShareTarget] = useState<{ id: string; label: string } | null>(null);
  const sharesQuery = useShareLinksQuery(canShare);

  const handleShare = useCallback((id: string, label: string) => {
    setShareTarget({ id, label });
  }, []);
  const handleSharesChanged = useCallback(() => {
    sharesQuery.refresh();
  }, [sharesQuery]);

  const handleDownload = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await downloadTree(id);
      } finally {
        setBusyId((prev) => (prev === id ? null : prev));
      }
    },
    [downloadTree],
  );

  const handleUnload = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await unloadTree(id);
      } finally {
        setBusyId((prev) => (prev === id ? null : prev));
      }
    },
    [unloadTree],
  );

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChosen = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        await importFromFile(file);
        toast.success(i18n.t("trees.toast.imported"));
      } catch (err) {
        toast.error(i18n.t("trees.toast.importFailed"), {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [importFromFile],
  );

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleCommitRename = useCallback(
    async (id: string, nextLabel: string) => {
      await renameTree(id, nextLabel);
      setEditingId(null);
    },
    [renameTree],
  );

  if (loading || !trees) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={i18n.t("trees.title")} description={i18n.t("trees.description")} />
        <TreesSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={i18n.t("trees.title")} description={i18n.t("trees.description")} />

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleImportClick}
          aria-label={i18n.t("trees.importAriaLabel")}
        >
          <Icons.Download />
          {i18n.t("trees.import")}
        </Button>
        <NewTreeDialog onCreate={newTree} />
        <input
          ref={fileInputRef}
          type="file"
          accept=".trail,.json,application/json,application/octet-stream"
          className="hidden"
          onChange={(e) => void handleFileChosen(e)}
        />
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeader eyebrow={i18n.t("trees.groupHeading.active")} />
        <ItemGroup>
          <Item variant="muted" size="sm">
            <ItemMedia variant="icon">
              <Icons.Bookmark className="text-muted-foreground" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{trees.active.label}</ItemTitle>
              <ItemDescription>{i18n.t("trees.activeDescription")}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <TreeSyncBadge
                treeId={trees.active.id}
                isStub={false}
                isActive
                state={syncMap.get(trees.active.id)}
                busy={false}
                onDownload={handleDownload}
                onUnload={handleUnload}
              />
              {canShare && (
                <ButtonTooltip label="Share trail">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Share trail"
                    onClick={() => handleShare(trees.active.id, trees.active.label)}
                  >
                    <Icons.Share2 />
                  </Button>
                </ButtonTooltip>
              )}
              <ButtonTooltip label={i18n.t("trees.actions.exportTree")}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={i18n.t("trees.actions.exportTree")}
                  onClick={() => void exportTree()}
                >
                  <Icons.Upload />
                </Button>
              </ButtonTooltip>
            </ItemActions>
          </Item>
        </ItemGroup>
      </section>

      {trees.others.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader eyebrow={i18n.t("trees.groupHeading.otherTrees")} />
          <ItemGroup>
            {trees.others.map((tree) => (
              <OtherTreeRow
                key={tree.id}
                tree={tree}
                isEditing={editingId === tree.id}
                syncState={syncMap.get(tree.id)}
                busy={(downloadPending || unloadPending) && busyId === tree.id}
                canShare={canShare}
                onStartEdit={handleStartEdit}
                onCancelEdit={handleCancelEdit}
                onCommitRename={handleCommitRename}
                onOpen={openTree}
                onExport={exportTree}
                onDelete={deleteTree}
                onDownload={handleDownload}
                onUnload={handleUnload}
                onShare={handleShare}
              />
            ))}
          </ItemGroup>
        </section>
      )}

      {canShare && (
        <SharedTrailsSection query={sharesQuery} onSharesChanged={handleSharesChanged} />
      )}

      {shareTarget && (
        <ShareDialog
          open={shareTarget !== null}
          onOpenChange={(next) => {
            if (!next) setShareTarget(null);
          }}
          treeId={shareTarget.id}
          treeLabel={shareTarget.label}
          onSharesChanged={handleSharesChanged}
        />
      )}
    </div>
  );
}

/* ─── Create tree dialog ─────────────────────────────────────── */

function NewTreeDialog({ onCreate }: { onCreate: (label: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onCreate(trimmed);
      setLabel("");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Icons.Plus data-icon="inline-start" />
          {i18n.t("trees.newTree")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{i18n.t("trees.createDialog.title")}</DialogTitle>
          <DialogDescription>{i18n.t("trees.createDialog.description")}</DialogDescription>
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
              <FieldLabel htmlFor="new-tree-label">
                {i18n.t("trees.createDialog.nameLabel")}
              </FieldLabel>
              <Input
                id="new-tree-label"
                placeholder={i18n.t("trees.createDialog.namePlaceholder")}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
                disabled={submitting}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {i18n.t("trees.createDialog.cancel")}
            </Button>
            <Button type="submit" disabled={!label.trim() || submitting}>
              {submitting
                ? i18n.t("trees.createDialog.creating")
                : i18n.t("trees.createDialog.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Per-tree sync state ────────────────────────────────────── */

function useTreeSyncMap(): Map<string, TreeSyncState> {
  const [stateMap, setStateMap] = useState<Record<string, SyncStateMeta>>({});
  const [pending, setPending] = useState<PendingSyncOp[]>([]);

  useEffect(() => {
    let active = true;
    void syncStateItem.getValue().then((v) => {
      if (active) setStateMap(v);
    });
    void pendingSyncOpsItem.getValue().then((v) => {
      if (active) setPending(v);
    });
    const unwatch = storage.watch<Record<string, SyncStateMeta>>(
      "local:trail_sync_state",
      (next) => {
        if (active && next) setStateMap(next);
      },
    );
    const unwatchPending = storage.watch<PendingSyncOp[]>(
      "local:trail_pending_sync_ops",
      (next) => {
        if (active && next) setPending(next);
      },
    );
    return () => {
      active = false;
      unwatch();
      unwatchPending();
    };
  }, []);

  const pendingIds = new Set(pending.map((op) => op.treeId));
  const result = new Map<string, TreeSyncState>();
  for (const [id, meta] of Object.entries(stateMap)) {
    const isPending = pendingIds.has(id);
    result.set(id, {
      kind: isPending ? "pending" : meta.lastSyncedAt ? "synced" : "local",
      lastSyncedAt: meta.lastSyncedAt,
    });
  }
  for (const id of pendingIds) {
    if (!result.has(id)) result.set(id, { kind: "pending", lastSyncedAt: null });
  }
  return result;
}

type TreeSyncState = {
  kind: "synced" | "pending" | "local";
  lastSyncedAt: string | null;
};

type TreeSyncBadgeProps = {
  treeId: string;
  isStub: boolean;
  isActive?: boolean;
  state: TreeSyncState | undefined;
  busy: boolean;
  onDownload: (id: string) => void | Promise<void>;
  onUnload: (id: string) => void | Promise<void>;
};

function TreeSyncBadge({
  treeId,
  isStub,
  isActive,
  state,
  busy,
  onDownload,
  onUnload,
}: TreeSyncBadgeProps) {
  const variant = resolveBadgeVariant({ isStub, isActive: !!isActive, state, busy });
  const handleClick =
    variant.kind === "download"
      ? () => void onDownload(treeId)
      : variant.kind === "unload"
        ? () => void onUnload(treeId)
        : undefined;

  return (
    <ButtonTooltip label={variant.tooltip}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={variant.ariaLabel}
        disabled={variant.disabled}
        onClick={handleClick}
      >
        {variant.icon}
      </Button>
    </ButtonTooltip>
  );
}

type BadgeVariant = {
  kind: "download" | "unload" | "static";
  tooltip: string;
  ariaLabel: string;
  disabled: boolean;
  icon: React.ReactNode;
};

function resolveBadgeVariant({
  isStub,
  isActive,
  state,
  busy,
}: {
  isStub: boolean;
  isActive: boolean;
  state: TreeSyncState | undefined;
  busy: boolean;
}): BadgeVariant {
  if (busy || state?.kind === "pending") {
    return {
      kind: "static",
      tooltip: busy ? i18n.t("trees.sync.working") : i18n.t("trees.sync.pending"),
      ariaLabel: i18n.t("trees.sync.inProgressAria"),
      disabled: true,
      icon: <Spinner />,
    };
  }

  if (isStub) {
    return {
      kind: "download",
      tooltip: i18n.t("trees.sync.cloudOnlyTooltip"),
      ariaLabel: i18n.t("trees.sync.cloudOnlyAria"),
      disabled: false,
      icon: <Icons.Cloud />,
    };
  }

  if (isActive) {
    if (state?.kind === "synced") {
      return {
        kind: "static",
        tooltip: state.lastSyncedAt
          ? i18n.t("trees.sync.syncedActiveTooltip", [formatRelative(state.lastSyncedAt)])
          : i18n.t("trees.sync.syncedActiveTooltipNoTime"),
        ariaLabel: i18n.t("trees.sync.syncedActiveAria"),
        disabled: true,
        icon: <Icons.Check />,
      };
    }
    return {
      kind: "static",
      tooltip: i18n.t("trees.sync.localActiveTooltip"),
      ariaLabel: i18n.t("trees.sync.localActiveAria"),
      disabled: true,
      icon: <Icons.CloudOff />,
    };
  }

  if (state?.kind === "synced") {
    return {
      kind: "unload",
      tooltip: state.lastSyncedAt
        ? i18n.t("trees.sync.syncedOfferUnloadTooltip", [formatRelative(state.lastSyncedAt)])
        : i18n.t("trees.sync.syncedOfferUnloadTooltipNoTime"),
      ariaLabel: i18n.t("trees.sync.unloadAria"),
      disabled: false,
      icon: <Icons.Check />,
    };
  }

  return {
    kind: "unload",
    tooltip: i18n.t("trees.sync.localOfferUploadTooltip"),
    ariaLabel: i18n.t("trees.sync.uploadAndUnloadAria"),
    disabled: false,
    icon: <Icons.CloudOff />,
  };
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

/* ─── Subcomponents ──────────────────────────────────────────── */

function TreesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-14 w-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

type OtherTreeRowProps = {
  tree: TreeIndexEntry;
  isEditing: boolean;
  syncState: TreeSyncState | undefined;
  busy: boolean;
  canShare: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onCommitRename: (id: string, nextLabel: string) => void | Promise<void>;
  onOpen: (id: string) => void | Promise<void>;
  onExport: (id?: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onDownload: (id: string) => void | Promise<void>;
  onUnload: (id: string) => void | Promise<void>;
  onShare: (id: string, label: string) => void;
};

const OtherTreeRow = memo(function OtherTreeRow({
  tree,
  isEditing,
  syncState,
  busy,
  canShare,
  onStartEdit,
  onCancelEdit,
  onCommitRename,
  onOpen,
  onExport,
  onDelete,
  onDownload,
  onUnload,
  onShare,
}: OtherTreeRowProps) {
  const stub = isTreeStub(tree);
  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <Icons.Folder className="text-muted-foreground" />
      </ItemMedia>
      <ItemContent>
        {isEditing ? (
          <RenameField
            initial={tree.label}
            onCommit={(next) => void onCommitRename(tree.id, next)}
            onCancel={onCancelEdit}
          />
        ) : (
          <ItemTitle className="cursor-text" onDoubleClick={() => onStartEdit(tree.id)}>
            {tree.label}
          </ItemTitle>
        )}
        <ItemDescription>
          {i18n.t("trees.nodes", [tree.nodeCount.toLocaleString()])}
        </ItemDescription>
      </ItemContent>
      {!isEditing && (
        <ItemActions>
          <TreeSyncBadge
            treeId={tree.id}
            isStub={stub}
            state={syncState}
            busy={busy}
            onDownload={onDownload}
            onUnload={onUnload}
          />
          <Button variant="ghost" size="sm" onClick={() => void onOpen(tree.id)}>
            {i18n.t("trees.open")}
          </Button>
          <ButtonTooltip label={i18n.t("trees.actions.rename")}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={i18n.t("trees.actions.rename")}
              onClick={() => onStartEdit(tree.id)}
            >
              <Icons.Pencil />
            </Button>
          </ButtonTooltip>
          {!stub && canShare && (
            <ButtonTooltip label="Share trail">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Share trail"
                onClick={() => onShare(tree.id, tree.label)}
              >
                <Icons.Share2 />
              </Button>
            </ButtonTooltip>
          )}
          {!stub && (
            <ButtonTooltip label={i18n.t("trees.actions.export")}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={i18n.t("trees.actions.export")}
                onClick={() => void onExport(tree.id)}
              >
                <Icons.Upload />
              </Button>
            </ButtonTooltip>
          )}
          <AlertDialog>
            <ButtonTooltip label={i18n.t("trees.actions.delete")}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  aria-label={i18n.t("trees.actions.delete")}
                >
                  <Icons.Trash2 />
                </Button>
              </AlertDialogTrigger>
            </ButtonTooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {i18n.t("trees.deleteDialog.title", [tree.label])}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {i18n.t("trees.deleteDialog.description")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{i18n.t("trees.deleteDialog.cancel")}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void onDelete(tree.id)}>
                  {i18n.t("trees.deleteDialog.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </ItemActions>
      )}
    </Item>
  );
});

function RenameField({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const submit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== initial) onCommit(trimmed);
    else onCancel();
  };
  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") onCancel();
      }}
      onBlur={submit}
      onFocus={(e) => e.currentTarget.select()}
      className="h-7 max-w-sm"
    />
  );
}

/* ─── Shared trails section ──────────────────────────────────── */

type ShareLinksQueryState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; rows: ShareLinkRow[] }
  | { kind: "error"; message: string };

type ShareLinksQuery = {
  state: ShareLinksQueryState;
  refresh: () => void;
};

/**
 * Loads the caller's active share-link rows. Skips the RPC when
 * signed-out so an authenticated-only function never gets called as
 * `anon` (which would return "permission denied"). Refresh is exposed
 * so the dialog can re-pull after a create/revoke.
 *
 * The parent gates rendering on `enabled`, so when sign-out flips the
 * gate the section unmounts entirely — we don't need to transition
 * stale state to "idle" inside the effect.
 */
function useShareLinksQuery(enabled: boolean): ShareLinksQuery {
  const [state, setState] = useState<ShareLinksQueryState>(() =>
    enabled ? { kind: "loading" } : { kind: "idle" },
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await listMyShareLinks();
        if (cancelled) return;
        setState({
          kind: "ready",
          rows: rows.filter((r) => r.revoked_at === null),
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to load shares",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, tick]);

  return {
    state,
    refresh: () => setTick((n) => n + 1),
  };
}

function SharedTrailsSection({
  query,
  onSharesChanged,
}: {
  query: ShareLinksQuery;
  onSharesChanged: () => void;
}) {
  const [revokingCode, setRevokingCode] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState<string | null>(null);

  const handleCopy = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(code));
      toast.success("Link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  }, []);

  const handleRevoke = useCallback(
    async (code: string) => {
      setRevokingCode(code);
      try {
        await revokeShareLink(code);
        toast.success("Share link revoked");
        onSharesChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to revoke share link");
      } finally {
        setRevokingCode(null);
        setConfirmCode(null);
      }
    },
    [onSharesChanged],
  );

  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        eyebrow="Shared trails"
        description="Active public links you minted. Revoking a link blocks new viewers; people who already imported keep their copy."
      />

      {query.state.kind === "loading" ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner className="size-4" />
          Loading shares…
        </div>
      ) : query.state.kind === "error" ? (
        <p className="text-destructive text-sm">{query.state.message}</p>
      ) : query.state.kind === "ready" && query.state.rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No active share links yet.</p>
      ) : query.state.kind === "ready" ? (
        <ItemGroup>
          {query.state.rows.map((row) => (
            <Item key={row.code} variant="outline" size="sm">
              <ItemMedia variant="icon">
                <Icons.Share2 className="text-muted-foreground" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{row.label}</ItemTitle>
                <ItemDescription className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="truncate">{buildShareUrl(row.code)}</span>
                </ItemDescription>
                <ItemDescription className="text-[11px]">
                  {row.view_count} {row.view_count === 1 ? "view" : "views"} · {row.node_count}{" "}
                  {row.node_count === 1 ? "node" : "nodes"} · {formatRelative(row.created_at)}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <ButtonTooltip label="Copy link">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy share link"
                    onClick={() => void handleCopy(row.code)}
                  >
                    <Icons.Link />
                  </Button>
                </ButtonTooltip>
                <ButtonTooltip label="Stop sharing">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Stop sharing"
                    disabled={revokingCode === row.code}
                    onClick={() => setConfirmCode(row.code)}
                  >
                    {revokingCode === row.code ? <Spinner /> : <Icons.Trash2 />}
                  </Button>
                </ButtonTooltip>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      ) : null}

      <AlertDialog
        open={confirmCode !== null}
        onOpenChange={(next) => {
          if (revokingCode !== null) return;
          if (!next) setConfirmCode(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop sharing this trail?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone with the link loses access. People who already imported keep their copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokingCode !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={revokingCode !== null}
              onClick={() => {
                if (confirmCode) void handleRevoke(confirmCode);
              }}
            >
              Stop sharing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
