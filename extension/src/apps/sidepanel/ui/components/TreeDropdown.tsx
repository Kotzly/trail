import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  createNewTree,
  deleteTree,
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
import { Spinner } from "@ui/components/ui/spinner";
import { useBoolean } from "@ui/hooks/use-boolean";
import { useLockFn } from "@ui/hooks/use-lock-fn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@ui/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@ui/components/ui/empty";
import { Input } from "@ui/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ui/components/ui/popover";
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

const TREES_KEYS = ["shift", "T"] as const;
const SEARCH_THRESHOLD = 6;

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

  const otherTrees = useMemo(() => {
    return [...trees.others]
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
  }, [trees.others]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmOpen, confirmOpenActions] = useBoolean(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [deletePending, setDeletePending] = useState<string | null>(null);
  const [creating, creatingActions] = useBoolean(false);
  const [importing, importingActions] = useBoolean(false);
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

  const handleDelete = useCallback(
    async (treeId: string) => {
      if (deletePending === treeId) return;
      try {
        setDeletePending(treeId);
        await deleteTree(treeId);
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

  const handleNewTree = useLockFn(async () => {
    try {
      const label = labelDraft.trim() || "Unnamed Tree";
      creatingActions.setTrue();
      await createNewTree(label);
    } catch (error) {
      showOperationError("Create tree", error);
    } finally {
      creatingActions.setFalse();
    }
  });

  const handleImportFile = useLockFn(async (file: File) => {
    try {
      importingActions.setTrue();
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
      importingActions.setFalse();
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  });

  const totalCount = otherTrees.length + (activeTree ? 1 : 0);
  const showSearch = totalCount > SEARCH_THRESHOLD;
  const isEmpty = !activeTree && otherTrees.length === 0;

  return (
    <>
      <Popover open={treesOpen} onOpenChange={handlePopoverOpenChange}>
        <ButtonTooltip label="Saved trees" keys={TREES_KEYS}>
          <PopoverTrigger asChild>
            <Button
              id="treesBtn"
              variant="outline"
              size="icon"
              type="button"
              aria-label="Saved trees"
            >
              <Icons.ListTree />
            </Button>
          </PopoverTrigger>
        </ButtonTooltip>
        <PopoverContent
          align="start"
          className="flex max-h-[min(var(--radix-popover-content-available-height),640px)] w-[360px] flex-col gap-0 overflow-hidden p-0"
          id="treesDropdown"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command
            className="flex size-full min-h-0 flex-1 flex-col rounded-none! bg-transparent p-0! [&_[data-slot=command-input-wrapper]]:pb-2"
            shouldFilter={showSearch}
            loop
          >
            <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
              <Icons.ListTree className="text-muted-foreground size-3.5 opacity-70" />
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="text-[13px] font-medium">Trees</span>
                <span className="text-muted-foreground text-[11px]">
                  {totalCount} {totalCount === 1 ? "tree" : "trees"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
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
                    {importing ? <Spinner /> : <Icons.Download />}
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
                      confirmOpenActions.setTrue();
                    }}
                  >
                    <Icons.GitBranchPlus />
                  </Button>
                </ButtonTooltip>
              </div>
            </header>

            {showSearch && (
              <CommandInput
                placeholder="Search trees…"
                className="placeholder:text-muted-foreground/70"
              />
            )}

            {isEmpty ? (
              <EmptyState />
            ) : (
              <CommandList className="max-h-none min-h-0 flex-1 overflow-y-auto">
                <CommandEmpty className="text-muted-foreground py-6 text-center text-xs">
                  No trees match
                </CommandEmpty>

                <CommandGroup className="p-1">
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
                  {otherTrees.map((tree) => (
                    <OtherTreeRow
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
                      onDelete={handleDelete}
                    />
                  ))}
                </CommandGroup>
              </CommandList>
            )}
          </Command>
        </PopoverContent>
      </Popover>

      <NewTreeDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!creating) confirmOpenActions.set(open);
        }}
        confirmNewTree={confirmNewTree}
        label={labelDraft}
        creating={creating}
        onLabelChange={setLabelDraft}
        onConfirm={() => {
          if (creating) return;
          confirmOpenActions.setFalse();
          void handleNewTree();
        }}
      />
    </>
  );
}

/* ─── Row primitives ─────────────────────────────────────────────── */

const rowClass =
  "group/tree data-[selected=true]:bg-accent relative flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none select-none";

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

  const searchValue = `${tree.id} ${tree.label}`;

  return (
    <CommandPrimitive.Item
      value={searchValue}
      className={cn(rowClass, "bg-muted/50 data-[selected=true]:bg-muted")}
      disabled
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <TreeFavicon tree={tree} />
      </span>
      <RowBody
        tree={tree}
        isEditing={isEditing}
        meta={meta}
        onStartEdit={onStartEdit}
        onCommitRename={onCommitRename}
        onCancelEdit={onCancelEdit}
      />
      {!isEditing && (
        <div className="flex shrink-0 items-center gap-0.5">
          <IconAction label="Rename" icon={<Icons.Pencil />} onClick={() => onStartEdit(tree.id)} />
          <IconAction label="Export tree" icon={<Icons.Upload />} onClick={() => onExport()} />
          <IconAction
            label="Open in editor"
            icon={<Icons.ExternalLink />}
            onClick={() => onOpenEditor(tree.id)}
          />
        </div>
      )}
    </CommandPrimitive.Item>
  );
});

type OtherTreeRowProps = {
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

const OtherTreeRow = memo(function OtherTreeRow({
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
}: OtherTreeRowProps) {
  const clickable = !loading && !unavailable && !isEditing;
  const meta = [
    tree.stub ? (unavailable ? "unavailable" : "cloud") : null,
    formatHost(tree.rootUrl),
    formatNodeCount(tree.nodeCount),
    formatDate(tree.savedAt),
  ]
    .filter(Boolean)
    .join(" \u00b7 ");

  const searchValue = `${tree.id} ${tree.label} ${formatHost(tree.rootUrl) ?? ""}`;

  return (
    <CommandPrimitive.Item
      value={searchValue}
      onSelect={clickable ? () => void onOpen(tree) : undefined}
      disabled={!clickable}
      className={cn(
        rowClass,
        clickable && "cursor-pointer",
        loading && "opacity-60",
        unavailable && "opacity-50",
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <TreeFavicon tree={tree} loading={loading} unavailable={unavailable} />
      </span>
      <RowBody
        tree={tree}
        isEditing={isEditing}
        meta={meta}
        onStartEdit={onStartEdit}
        onCommitRename={onCommitRename}
        onCancelEdit={onCancelEdit}
      />
      {!isEditing && !loading && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/tree:opacity-100 group-data-[selected=true]/tree:opacity-100">
          <IconAction label="Rename" icon={<Icons.Pencil />} onClick={() => onStartEdit(tree.id)} />
          {!tree.stub && (
            <IconAction
              label="Export tree"
              icon={<Icons.Upload />}
              onClick={() => onExport(tree.id)}
            />
          )}
          <IconAction
            label="Open in editor"
            icon={<Icons.ExternalLink />}
            onClick={() => onOpenEditor(tree.id)}
          />
          <IconAction
            label="Delete tree"
            icon={<Icons.Trash2 />}
            disabled={deleting}
            onClick={() => onDelete(tree.id)}
          />
        </div>
      )}
    </CommandPrimitive.Item>
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

function RowBody({ tree, isEditing, meta, onCommitRename, onCancelEdit }: RowBodyProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col leading-tight">
      {isEditing ? (
        <RenameField
          initial={tree.label}
          onCommit={(next) => void onCommitRename(tree.id, next)}
          onCancel={onCancelEdit}
        />
      ) : (
        <span className="truncate">
          {displayLabel({
            label: tree.label,
            ...(tree.rootTitle ? { rootTitle: tree.rootTitle } : {}),
            ...(tree.rootUrl ? { rootUrl: tree.rootUrl } : {}),
          })}
        </span>
      )}
      {meta && !isEditing ? (
        <span className="text-muted-foreground truncate text-[11px]">{meta}</span>
      ) : null}
    </div>
  );
}

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
        e.stopPropagation();
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
      onMouseDown={(e) => e.stopPropagation()}
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
        className="text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onMouseDown={(e) => e.stopPropagation()}
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
    return <Spinner className="text-muted-foreground size-4" />;
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
            {confirmNewTree ? "Create a new tree" : "Name your new tree"}
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
