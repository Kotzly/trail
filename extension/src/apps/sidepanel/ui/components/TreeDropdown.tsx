import { useEffect, useMemo, useRef, useState } from "react";
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

import {
  displayLabel,
  formatDate,
  formatHost,
  formatNodeCount,
  formatRelativeTime,
} from "../shared/format.js";

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
  const treesShortcut = "Shift+T";
  const nodeCount = useStore((state) => state.nodeCount);
  const lastSyncedAt: string | null = null;

  useOverlayEffects(treesOpen, { kind: "dropdown" });

  const inputRef = useRef<HTMLInputElement | null>(null);

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
  const [draft, setDraft] = useState("");
  const editing = editingId !== null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [renamePending, setRenamePending] = useState(false);
  const [deletePending, setDeletePending] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loadingTreeId, setLoadingTreeId] = useState<string | null>(null);
  const [unavailableTreeIds, setUnavailableTreeIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!treesOpen) {
      setEditingId(null);
      setDraft("");
    }
  }, [treesOpen]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const startEdit = (tree: TreeItem) => {
    setEditingId(tree.id);
    setDraft(tree.label);
  };

  const commitEdit = async () => {
    if (!editingId) return;
    if (renamePending) return;
    const nextLabel = draft.trim() || "Unnamed Tree";
    try {
      setRenamePending(true);
      await renameTree(editingId, nextLabel);
    } catch (error) {
      showOperationError("Rename", error);
    } finally {
      setRenamePending(false);
      setEditingId(null);
      setDraft("");
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft("");
  };

  const handleOpen = async (tree: TreeItem) => {
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
  };

  const handleDeleteArchived = async (treeId: string) => {
    if (deletePending === treeId) return;
    try {
      setDeletePending(treeId);
      await deleteArchivedTree(treeId);
    } catch (error) {
      showOperationError("Delete tree", error);
    } finally {
      setDeletePending(null);
    }
  };

  const handleExport = async (treeId?: string) => {
    try {
      const bundle = await exportTree(treeId);
      downloadBundle(bundle);
      toast.success("Exported as JSON");
    } catch (error) {
      showOperationError("Export", error);
    }
  };

  const openTrailEditor = async (treeId: string) => {
    try {
      await initBackendConfig();
      const baseUrl = getBackendConfig().baseUrl;
      await browser.tabs.create({ url: `${baseUrl}/trails/${treeId}`, active: true });
    } catch (error) {
      showOperationError("Open editor", error);
    }
  };

  const handleNewTree = async () => {
    try {
      const label = labelDraft.trim() || "Unnamed Tree";
      setCreating(true);
      await createNewTree(label);
    } catch (error) {
      showOperationError("Create tree", error);
    } finally {
      setCreating(false);
    }
  };

  const handleImportFile = async (file: File) => {
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
  };

  const treesTooltip = `Saved trees (${treesShortcut})`;

  return (
    <>
      <Popover open={treesOpen} onOpenChange={setTreesOpen}>
        <PopoverTrigger asChild>
          <Button
            id="treesBtn"
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={treesTooltip}
            data-tooltip={treesTooltip}
          >
            <Icons.ListTree />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[360px] p-0" id="treesDropdown">
          {/* Single compact toolbar: title + count on the left, import + new
              on the right. No other section headers — the active row sits
              on top, archived rows below. */}
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <div className="text-muted-foreground flex items-center gap-1.5 px-1.5 text-[12px]">
              <span>Trees</span>
              <span className="bg-muted rounded px-1.5 py-px text-[10px] tabular-nums">
                {archivedTrees.length + (activeTree ? 1 : 0)}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
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
              <Button
                variant="ghost"
                size="icon-xs"
                type="button"
                aria-label="Import trail"
                data-tooltip="Import trail"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                {importing ? <Icons.Loader2 className="animate-spin" /> : <Icons.Upload />}
              </Button>
              <Button
                id="newTreeBtn"
                variant="ghost"
                size="icon-xs"
                type="button"
                aria-label="New tree"
                data-tooltip="New tree"
                onClick={() => {
                  setLabelDraft("");
                  closeAllPopups();
                  setConfirmOpen(true);
                }}
              >
                <Icons.GitBranchPlus />
              </Button>
            </div>
          </div>
          <Separator />

          <ScrollArea className="max-h-[420px]">
            {!activeTree && archivedTrees.length === 0 ? (
              <EmptyState />
            ) : (
              <ItemGroup className="p-1">
                {activeTree && (
                  <TreeRow
                    tree={activeTree}
                    active
                    isEditing={editingId === activeTree.id}
                    draft={draft}
                    inputRef={inputRef}
                    meta={[
                      formatNodeCount(activeTree.nodeCount),
                      lastSyncedAt ? `synced ${formatRelativeTime(lastSyncedAt)}` : "active now",
                    ]
                      .filter(Boolean)
                      .join(" \u00b7 ")}
                    onStartEdit={() => startEdit(activeTree)}
                    onDraftChange={setDraft}
                    onCommitEdit={commitEdit}
                    onCancelEdit={cancelEdit}
                    onExport={() => void handleExport()}
                    onOpenEditor={() => void openTrailEditor(activeTree.id)}
                  />
                )}
                {archivedTrees.map((tree) => {
                  const isLoading = loadingTreeId === tree.id;
                  const isUnavailable = unavailableTreeIds.has(tree.id);
                  const host = formatHost(tree.rootUrl);
                  const meta = [
                    tree.stub ? (isUnavailable ? "unavailable" : "cloud") : null,
                    host,
                    formatNodeCount(tree.nodeCount),
                    formatDate(tree.savedAt),
                  ]
                    .filter(Boolean)
                    .join(" \u00b7 ");

                  return (
                    <TreeRow
                      key={tree.id}
                      tree={tree}
                      loading={isLoading}
                      unavailable={isUnavailable}
                      isEditing={editingId === tree.id}
                      draft={draft}
                      inputRef={inputRef}
                      meta={meta}
                      onOpen={() => void handleOpen(tree)}
                      onStartEdit={() => startEdit(tree)}
                      onDraftChange={setDraft}
                      onCommitEdit={commitEdit}
                      onCancelEdit={cancelEdit}
                      onExport={() => void handleExport(tree.id)}
                      onOpenEditor={() => void openTrailEditor(tree.id)}
                      onDelete={() => void handleDeleteArchived(tree.id)}
                      deleting={deletePending === tree.id}
                    />
                  );
                })}
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

type TreeRowProps = {
  tree: TreeItem;
  active?: boolean;
  loading?: boolean;
  unavailable?: boolean;
  isEditing: boolean;
  draft: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  meta: string;
  onOpen?: () => void;
  onStartEdit: () => void;
  onDraftChange: (v: string) => void;
  onCommitEdit: () => void | Promise<void>;
  onCancelEdit: () => void;
  onExport: () => void;
  onOpenEditor: () => void;
  onDelete?: () => void;
  deleting?: boolean;
};

/**
 * One flat shadcn-style row. Same layout for the active tree and each
 * archived tree — the active row just carries `bg-accent` and lives at
 * the top of the list.
 */
function TreeRow({
  tree,
  active,
  loading,
  unavailable,
  isEditing,
  draft,
  inputRef,
  meta,
  onOpen,
  onStartEdit,
  onDraftChange,
  onCommitEdit,
  onCancelEdit,
  onExport,
  onOpenEditor,
  onDelete,
  deleting,
}: TreeRowProps) {
  const clickable = !active && !loading && !unavailable && Boolean(onOpen);
  return (
    <Item
      variant={active ? "muted" : "default"}
      size="xs"
      className={cn(
        "group/row border-transparent",
        !active && "hover:bg-accent",
        clickable && "cursor-pointer",
        loading && "pointer-events-none opacity-60",
        unavailable && "opacity-50",
      )}
      onClick={() => clickable && onOpen?.()}
    >
      <ItemMedia variant="icon">
        <TreeFavicon tree={tree} loading={loading} unavailable={unavailable} />
      </ItemMedia>

      <ItemContent>
        {isEditing ? (
          <Input
            ref={inputRef}
            className="h-6 px-1.5 text-[13px]"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onCommitEdit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onCancelEdit();
              }
            }}
            onBlur={() => void onCommitEdit()}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <ItemTitle
            className="cursor-text text-[13px]"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartEdit();
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

      {!isEditing && !loading && (
        <ItemActions
          className={cn(
            "gap-0.5 transition-opacity",
            active ? "opacity-100" : "opacity-0 group-hover/row:opacity-100",
          )}
        >
          {!tree.stub && (
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              aria-label="Export tree"
              data-tooltip="Export tree"
              onClick={(e) => {
                e.stopPropagation();
                onExport();
              }}
            >
              <Icons.Download />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            aria-label="Open in editor"
            data-tooltip="Open in editor"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEditor();
            }}
          >
            <Icons.Pencil />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              aria-label="Delete tree"
              data-tooltip="Delete tree"
              disabled={deleting}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Icons.Trash2 />
            </Button>
          )}
        </ItemActions>
      )}
    </Item>
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
