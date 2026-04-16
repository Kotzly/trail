import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  createNewTree,
  deleteArchivedTree,
  ensureTreeLoaded,
  exportTree,
  importTrail,
  openTree,
  renameTree,
} from "../../api/tree.js";
import { getBackendConfig, initBackendConfig } from "@shared/config/backend.js";
import { useStore } from "../state/store.js";
import { useOverlayEffects } from "../state/overlay-effects.js";
import { cn } from "@ui/lib/utils";
import { Icons } from "./Icon.js";

import type { FaviconUrl, Title, Url } from "@shared/types/ids.js";
import { getFaviconUrl } from "@shared/utils/favicon.js";
import { EXPORT_SCHEMA, type TrailExportBundle } from "@shared/types/export.js";
import { toast } from "sonner";
import { browser } from "@shared/platform/webext.js";
import { showOperationError } from "../shared/show-operation-error.js";
import { Button } from "@ui/components/ui/button";
import { CardAction, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@ui/components/ui/empty";
import { Input } from "@ui/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@ui/components/ui/item";
import { Popover, PopoverContent, PopoverTrigger } from "@ui/components/ui/popover";
import { ScrollArea } from "@ui/components/ui/scroll-area";
import { Separator } from "@ui/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/components/ui/dialog";
import { ButtonTooltip } from "@ui/components/button-tooltip";
import {
  displayLabel,
  formatDate,
  formatHost,
  formatNodeCount,
  formatRelativeTime,
} from "../shared/format.js";

type TreeItem = {
  id: string;
  label: string;
  nodeCount: number;
  rootUrl?: Url;
  rootTitle?: Title;
  rootFavicon?: FaviconUrl;
  savedAt?: number;
  stub?: boolean;
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-. ]/g, "_").trim() || "trail";
}

function downloadBundle(bundle: TrailExportBundle): void {
  const label = bundle.source.treeLabel ?? "trail";
  const json = JSON.stringify(bundle);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(label)}.trail.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TreeDropdown() {
  const trees = useStore((state) => state.trees);
  const treesOpen = useStore((state) => state.ui.treesOpen);
  const setTreesOpen = useStore((state) => state.setTreesOpen);
  const closeAllPopups = useStore((state) => state.closeAllPopups);
  const confirmNewTree = useStore((state) => state.settings?.confirmNewTree ?? true);
  const nodeCount = useStore((state) => state.nodeCount);
  const lastSyncedAt: string | null = null;

  useOverlayEffects(treesOpen, { kind: "dropdown" });

  const activeTree = trees.active
    ? ({
        id: trees.active.id,
        label: trees.active.label,
        nodeCount,
      } as TreeItem)
    : null;

  const archivedTrees = useMemo(() => {
    return [...trees.archived]
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
      .map((entry) => {
        const item: TreeItem = {
          id: entry.id,
          label: entry.label,
          nodeCount: entry.nodeCount,
          savedAt: entry.savedAt,
          ...(entry.rootUrl != null && { rootUrl: entry.rootUrl }),
          ...(entry.rootTitle != null && { rootTitle: entry.rootTitle }),
          ...(entry.rootFavicon != null && { rootFavicon: entry.rootFavicon }),
        };
        if ("stub" in entry && (entry as { stub?: boolean }).stub) {
          item.stub = true;
        }
        return item;
      });
  }, [trees.archived]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [deletePending, setDeletePending] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loadingTreeId, setLoadingTreeId] = useState<string | null>(null);
  const [unavailableTreeIds, setUnavailableTreeIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePopoverOpenChange = useCallback(
    (open: boolean) => {
      setTreesOpen(open);
      if (!open) setEditingId(null);
    },
    [setTreesOpen],
  );

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleCommitRename = useCallback(async (treeId: string, nextLabel: string) => {
    try {
      await renameTree(treeId, nextLabel);
    } catch (error) {
      showOperationError("Rename", error);
    } finally {
      setEditingId(null);
    }
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleOpen = useCallback(
    async (tree: TreeItem) => {
      if (tree.stub) {
        setLoadingTreeId(tree.id);
        try {
          await ensureTreeLoaded(tree.id);
        } catch (loadError) {
          showOperationError("Load tree from cloud", loadError);
          setUnavailableTreeIds((prev) => new Set(prev).add(tree.id));
          setLoadingTreeId(null);
          return;
        }
      }
      try {
        await openTree(tree.id);
      } catch (openError) {
        showOperationError("Open tree", openError);
      } finally {
        setLoadingTreeId(null);
        setTreesOpen(false);
      }
    },
    [setTreesOpen],
  );

  const handleDeleteArchived = useCallback(
    async (treeId: string) => {
      if (deletePending === treeId) return;
      try {
        setDeletePending(treeId);
        await deleteArchivedTree(treeId);
      } catch (error) {
        showOperationError("Delete tree", error);
      } finally {
        setDeletePending(null);
      }
    },
    [deletePending],
  );

  const handleExport = useCallback(async (treeId?: string) => {
    try {
      const bundle = await exportTree(treeId);
      downloadBundle(bundle);
      toast.success("Exported as JSON");
    } catch (error) {
      showOperationError("Export", error);
    }
  }, []);

  const openTrailEditor = useCallback(async (treeId: string) => {
    try {
      await initBackendConfig();
      const baseUrl = getBackendConfig().baseUrl;
      await browser.tabs.create({ url: `${baseUrl}/trails/${treeId}`, active: true });
    } catch (error) {
      showOperationError("Open editor", error);
    }
  }, []);

  const handleNewTree = useCallback(async () => {
    try {
      const label = labelDraft.trim() || "Unnamed Tree";
      setCreating(true);
      await createNewTree(label);
    } catch (error) {
      showOperationError("Create tree", error);
    } finally {
      setCreating(false);
    }
  }, [labelDraft]);

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        setImporting(true);
        const text = await file.text();
        const bundle = JSON.parse(text) as TrailExportBundle;
        if (bundle.schema !== EXPORT_SCHEMA) {
          toast.error("Unsupported file format");
          return;
        }
        await importTrail(bundle);
        setTreesOpen(false);
        toast.success("Trail imported");
      } catch (error) {
        showOperationError("Import", error);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [setTreesOpen],
  );

  const isMac = useStore((state) => state.isMac);
  const treesKeys = [isMac ? "⇧" : "Shift", "T"];
  const totalCount = archivedTrees.length + (activeTree ? 1 : 0);

  return (
    <>
      <Popover open={treesOpen} onOpenChange={handlePopoverOpenChange}>
        <ButtonTooltip label="Saved trees" keys={treesKeys}>
          <PopoverTrigger asChild>
            <Button
              id="treesBtn"
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label="Saved trees"
            >
              <Icons.ListTree />
            </Button>
          </PopoverTrigger>
        </ButtonTooltip>
        <PopoverContent align="start" className="w-[360px] p-0" id="treesDropdown">
          <CardHeader className="px-3 py-2.5">
            <CardTitle className="text-[13px]">Trees</CardTitle>
            <CardDescription className="text-[11px]">
              {totalCount} {totalCount === 1 ? "tree" : "trees"}
            </CardDescription>
            <CardAction className="flex items-center gap-0.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".trail.json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportFile(file);
                }}
              />
              <ButtonTooltip label="Import trail">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  type="button"
                  aria-label="Import trail"
                  disabled={importing}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {importing ? <Icons.Loader2 className="animate-spin" /> : <Icons.Upload />}
                </Button>
              </ButtonTooltip>
              <ButtonTooltip label="New tree">
                <Button
                  id="newTreeBtn"
                  variant="ghost"
                  size="icon-xs"
                  type="button"
                  aria-label="New tree"
                  onClick={() => {
                    setLabelDraft("");
                    closeAllPopups();
                    setConfirmOpen(true);
                  }}
                >
                  <Icons.GitBranchPlus />
                </Button>
              </ButtonTooltip>
            </CardAction>
          </CardHeader>
          <Separator />

          <ScrollArea className="max-h-[420px]">
            {!activeTree && archivedTrees.length === 0 ? (
              <EmptyState />
            ) : (
              <ItemGroup className="p-1">
                {activeTree && (
                  <ActiveTreeRow
                    tree={activeTree}
                    isEditing={editingId === activeTree.id}
                    syncedAt={lastSyncedAt}
                    onStartEdit={handleStartEdit}
                    onCommitRename={handleCommitRename}
                    onCancelEdit={handleCancelEdit}
                    onExport={handleExport}
                    onOpenEditor={openTrailEditor}
                  />
                )}
                {archivedTrees.map((tree) => (
                  <ArchivedTreeRow
                    key={tree.id}
                    tree={tree}
                    isEditing={editingId === tree.id}
                    loading={loadingTreeId === tree.id}
                    unavailable={unavailableTreeIds.has(tree.id)}
                    deleting={deletePending === tree.id}
                    onStartEdit={handleStartEdit}
                    onCommitRename={handleCommitRename}
                    onCancelEdit={handleCancelEdit}
                    onOpen={handleOpen}
                    onExport={handleExport}
                    onOpenEditor={openTrailEditor}
                    onDelete={handleDeleteArchived}
                  />
                ))}
              </ItemGroup>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <NewTreeDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!creating) setConfirmOpen(open);
        }}
        confirmNewTree={confirmNewTree}
        label={labelDraft}
        creating={creating}
        onLabelChange={setLabelDraft}
        onConfirm={() => {
          if (creating) return;
          setConfirmOpen(false);
          void handleNewTree();
        }}
      />
    </>
  );
}

/* ─── Explicit variant: ActiveTreeRow ────────────────────────────── */

type ActiveTreeRowProps = {
  tree: TreeItem;
  isEditing: boolean;
  syncedAt: string | null;
  onStartEdit: (id: string) => void;
  onCommitRename: (id: string, nextLabel: string) => void | Promise<void>;
  onCancelEdit: () => void;
  onExport: (treeId?: string) => void;
  onOpenEditor: (treeId: string) => void;
};

const ActiveTreeRow = memo(function ActiveTreeRow({
  tree,
  isEditing,
  syncedAt,
  onStartEdit,
  onCommitRename,
  onCancelEdit,
  onExport,
  onOpenEditor,
}: ActiveTreeRowProps) {
  const meta = [
    formatNodeCount(tree.nodeCount),
    syncedAt ? `synced ${formatRelativeTime(syncedAt)}` : "active now",
  ]
    .filter(Boolean)
    .join(" \u00b7 ");

  return (
    <Item variant="muted" size="xs" className="border-transparent">
      <ItemMedia variant="icon">
        <TreeFavicon tree={tree} />
      </ItemMedia>
      <RowBody
        tree={tree}
        isEditing={isEditing}
        meta={meta}
        onStartEdit={onStartEdit}
        onCommitRename={onCommitRename}
        onCancelEdit={onCancelEdit}
      />
      {!isEditing && (
        <ItemActions className="gap-0.5">
          <IconAction label="Export tree" icon={<Icons.Download />} onClick={() => onExport()} />
          <IconAction
            label="Open in editor"
            icon={<Icons.Pencil />}
            onClick={() => onOpenEditor(tree.id)}
          />
        </ItemActions>
      )}
    </Item>
  );
});

/* ─── Explicit variant: ArchivedTreeRow ──────────────────────────── */

type ArchivedTreeRowProps = {
  tree: TreeItem;
  isEditing: boolean;
  loading: boolean;
  unavailable: boolean;
  deleting: boolean;
  onStartEdit: (id: string) => void;
  onCommitRename: (id: string, nextLabel: string) => void | Promise<void>;
  onCancelEdit: () => void;
  onOpen: (tree: TreeItem) => void;
  onExport: (treeId: string) => void;
  onOpenEditor: (treeId: string) => void;
  onDelete: (treeId: string) => void;
};

const ArchivedTreeRow = memo(function ArchivedTreeRow({
  tree,
  isEditing,
  loading,
  unavailable,
  deleting,
  onStartEdit,
  onCommitRename,
  onCancelEdit,
  onOpen,
  onExport,
  onOpenEditor,
  onDelete,
}: ArchivedTreeRowProps) {
  const clickable = !loading && !unavailable && !isEditing;
  const meta = [
    tree.stub ? (unavailable ? "unavailable" : "cloud") : null,
    formatHost(tree.rootUrl),
    formatNodeCount(tree.nodeCount),
    formatDate(tree.savedAt),
  ]
    .filter(Boolean)
    .join(" \u00b7 ");

  return (
    <Item
      variant="default"
      size="xs"
      className={cn(
        "group/row border-transparent",
        clickable && "hover:bg-accent cursor-pointer",
        loading && "pointer-events-none opacity-60",
        unavailable && "opacity-50",
      )}
      onClick={clickable ? () => onOpen(tree) : undefined}
    >
      <ItemMedia variant="icon">
        <TreeFavicon tree={tree} loading={loading} unavailable={unavailable} />
      </ItemMedia>
      <RowBody
        tree={tree}
        isEditing={isEditing}
        meta={meta}
        onStartEdit={onStartEdit}
        onCommitRename={onCommitRename}
        onCancelEdit={onCancelEdit}
      />
      {!isEditing && !loading && (
        <ItemActions className="gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100">
          {!tree.stub && (
            <IconAction
              label="Export tree"
              icon={<Icons.Download />}
              onClick={() => onExport(tree.id)}
            />
          )}
          <IconAction
            label="Open in editor"
            icon={<Icons.Pencil />}
            onClick={() => onOpenEditor(tree.id)}
          />
          <IconAction
            label="Delete tree"
            icon={<Icons.Trash2 />}
            disabled={deleting}
            onClick={() => onDelete(tree.id)}
          />
        </ItemActions>
      )}
    </Item>
  );
});

/* ─── Shared row body + primitives ───────────────────────────────── */

type RowBodyProps = {
  tree: TreeItem;
  isEditing: boolean;
  meta: string;
  onStartEdit: (id: string) => void;
  onCommitRename: (id: string, nextLabel: string) => void | Promise<void>;
  onCancelEdit: () => void;
};

function RowBody({
  tree,
  isEditing,
  meta,
  onStartEdit,
  onCommitRename,
  onCancelEdit,
}: RowBodyProps) {
  return (
    <ItemContent>
      {isEditing ? (
        <RenameField
          initial={tree.label}
          onCommit={(next) => void onCommitRename(tree.id, next)}
          onCancel={onCancelEdit}
        />
      ) : (
        <ItemTitle
          className="cursor-text text-[13px]"
          onDoubleClick={(e) => {
            e.stopPropagation();
            onStartEdit(tree.id);
          }}
        >
          {displayLabel({
            label: tree.label,
            ...(tree.rootTitle ? { rootTitle: tree.rootTitle } : {}),
            ...(tree.rootUrl ? { rootUrl: tree.rootUrl } : {}),
          })}
        </ItemTitle>
      )}
      {meta ? <ItemDescription className="text-[11px]">{meta}</ItemDescription> : null}
    </ItemContent>
  );
}

/**
 * Inline rename input. Owns its own draft state — mounting when the
 * parent flips `isEditing` to true keeps the draft isolated from sibling
 * rows so typing in one row never re-renders the others.
 */
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
    const trimmed = draft.trim() || "Unnamed Tree";
    onCommit(trimmed);
  };
  return (
    <Input
      autoFocus
      className="h-6 px-1.5 text-[13px]"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={submit}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => e.currentTarget.select()}
    />
  );
}

function IconAction({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <ButtonTooltip label={label}>
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {icon}
      </Button>
    </ButtonTooltip>
  );
}

function TreeFavicon({
  tree,
  loading,
  unavailable,
}: {
  tree: TreeItem;
  loading?: boolean;
  unavailable?: boolean;
}) {
  if (loading) {
    return <Icons.Loader2 className="text-muted-foreground size-4 animate-spin" />;
  }
  if (tree.stub) {
    return unavailable ? (
      <Icons.CloudOff className="text-muted-foreground size-4" />
    ) : (
      <Icons.Cloud className="text-muted-foreground size-4" />
    );
  }
  if (tree.rootUrl) {
    return <img className="size-4 rounded-sm" alt="" src={getFaviconUrl(tree.rootUrl)} />;
  }
  return <Icons.Bookmark className="text-muted-foreground size-4" />;
}

function EmptyState() {
  return (
    <Empty className="border-0 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icons.ListTree />
        </EmptyMedia>
        <EmptyTitle className="text-sm">No trees yet</EmptyTitle>
        <EmptyDescription>Create a new tree to get started</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

type NewTreeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  confirmNewTree: boolean;
  label: string;
  creating: boolean;
  onLabelChange: (value: string) => void;
  onConfirm: () => void;
};

function NewTreeDialog({
  open,
  onOpenChange,
  confirmNewTree,
  label,
  creating,
  onLabelChange,
  onConfirm,
}: NewTreeDialogProps) {
  useOverlayEffects(open, { lod: true, blur: true, kind: "modal" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-sm font-normal">
            {confirmNewTree ? "create a new tree?" : "name your new tree"}
          </DialogTitle>
        </DialogHeader>
        <Input
          type="text"
          value={label}
          placeholder="Unnamed Tree"
          onChange={(e) => onLabelChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onConfirm();
            }
          }}
          autoFocus
        />
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button size="sm" type="button" onClick={onConfirm} disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
