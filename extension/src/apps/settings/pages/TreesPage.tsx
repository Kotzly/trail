import { memo, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { storage } from "wxt/utils/storage";
import { useTrees } from "../hooks/useTrees.js";
import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
import { Label } from "@ui/components/ui/label";
import { PageHeader } from "../components/PageHeader.js";
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
        toast.success("Tree imported.");
      } catch (err) {
        toast.error("Import failed", {
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
        <PageHeader title="Trees" description="Create, open, import, and export your trees." />
        <TreesSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Trees" description="Create, open, import, and export your trees." />

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleImportClick}
          aria-label="Import a .trail or .json export"
        >
          <Icons.Download />
          Import
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

      <ItemGroup>
        <Item variant="muted" size="sm">
          <ItemMedia variant="icon">
            <Icons.Bookmark className="text-muted-foreground" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{trees.active.label}</ItemTitle>
            <ItemDescription>Currently open in the sidepanel.</ItemDescription>
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
            <ButtonTooltip label="Export tree">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Export tree"
                onClick={() => void exportTree()}
              >
                <Icons.Upload />
              </Button>
            </ButtonTooltip>
          </ItemActions>
        </Item>
      </ItemGroup>

      {trees.others.length > 0 && (
        <ItemGroup>
          {trees.others.map((tree) => (
            <OtherTreeRow
              key={tree.id}
              tree={tree}
              isEditing={editingId === tree.id}
              syncState={syncMap.get(tree.id)}
              busy={(downloadPending || unloadPending) && busyId === tree.id}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onCommitRename={handleCommitRename}
              onOpen={openTree}
              onExport={exportTree}
              onDelete={deleteTree}
              onDownload={handleDownload}
              onUnload={handleUnload}
            />
          ))}
        </ItemGroup>
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
          <Icons.Plus />
          New tree
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new tree</DialogTitle>
          <DialogDescription>
            Trees are independent browsing maps. Each tree keeps its own nodes and history.
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
            <Label htmlFor="new-tree-label">Name</Label>
            <Input
              id="new-tree-label"
              placeholder="e.g. Research, Shopping, Trip planning"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              disabled={submitting}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!label.trim() || submitting}>
              {submitting ? "Creating…" : "Create"}
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
      tooltip: busy ? "Working…" : "Sync pending",
      ariaLabel: "In progress",
      disabled: true,
      icon: <Icons.Loader2 className="animate-spin" />,
    };
  }

  if (isStub) {
    return {
      kind: "download",
      tooltip: "Cloud only — click to download to this device",
      ariaLabel: "Download tree to this device",
      disabled: false,
      icon: <Icons.Cloud />,
    };
  }

  if (isActive) {
    if (state?.kind === "synced") {
      return {
        kind: "static",
        tooltip: state.lastSyncedAt
          ? `Synced · ${formatRelative(state.lastSyncedAt)} · active tree`
          : "Synced · active tree",
        ariaLabel: "Synced (active tree)",
        disabled: true,
        icon: <Icons.Check />,
      };
    }
    return {
      kind: "static",
      tooltip: "Local only · active tree (open another tree to unload this one)",
      ariaLabel: "Local only (active tree)",
      disabled: true,
      icon: <Icons.CloudOff />,
    };
  }

  if (state?.kind === "synced") {
    return {
      kind: "unload",
      tooltip: state.lastSyncedAt
        ? `Synced · ${formatRelative(state.lastSyncedAt)} · click to remove from this device`
        : "Synced · click to remove from this device",
      ariaLabel: "Unload tree from this device",
      disabled: false,
      icon: <Icons.Check />,
    };
  }

  return {
    kind: "unload",
    tooltip: "Local only — click to sync to cloud and remove from this device",
    ariaLabel: "Upload and unload tree",
    disabled: false,
    icon: <Icons.CloudOff />,
  };
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
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
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onCommitRename: (id: string, nextLabel: string) => void | Promise<void>;
  onOpen: (id: string) => void | Promise<void>;
  onExport: (id?: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onDownload: (id: string) => void | Promise<void>;
  onUnload: (id: string) => void | Promise<void>;
};

const OtherTreeRow = memo(function OtherTreeRow({
  tree,
  isEditing,
  syncState,
  busy,
  onStartEdit,
  onCancelEdit,
  onCommitRename,
  onOpen,
  onExport,
  onDelete,
  onDownload,
  onUnload,
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
        <ItemDescription>{tree.nodeCount.toLocaleString()} nodes</ItemDescription>
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
            Open
          </Button>
          <ButtonTooltip label="Rename">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Rename"
              onClick={() => onStartEdit(tree.id)}
            >
              <Icons.Pencil />
            </Button>
          </ButtonTooltip>
          {!stub && (
            <ButtonTooltip label="Export">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Export"
                onClick={() => void onExport(tree.id)}
              >
                <Icons.Upload />
              </Button>
            </ButtonTooltip>
          )}
          <AlertDialog>
            <ButtonTooltip label="Delete">
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon-sm" aria-label="Delete">
                  <Icons.Trash2 />
                </Button>
              </AlertDialogTrigger>
            </ButtonTooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &ldquo;{tree.label}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes the tree and all its nodes. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void onDelete(tree.id)}>
                  Delete
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
