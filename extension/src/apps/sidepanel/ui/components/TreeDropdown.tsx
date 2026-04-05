import { useEffect, useMemo, useRef, useState } from "react";
import {
  createNewTree,
  deleteArchivedTree,
  ensureTreeLoaded,
  exportTree,
  openTree,
  renameTree,
  syncTrees,
} from "../../api/tree.js";
import { getBackendConfig, initBackendConfig } from "@shared/config/backend.js";
import { useStore } from "../state/store.js";
import { useOverlayEffects } from "../state/overlay-effects.js";
import { cn } from "@ui/lib/utils";
import { Icons } from "./Icon.js";

import type { FaviconUrl, Title, Url } from "@shared/types/ids.js";
import { getFaviconUrl } from "@shared/utils/favicon.js";
import type { TrailExportBundle } from "@shared/types/export.js";
import { toast } from "sonner";
import { browser } from "@shared/platform/webext.js";
import { showOperationError } from "../shared/show-operation-error.js";
import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
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

function formatHost(url?: Url): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function formatDate(ts?: number): string {
  if (!ts) return "";
  try {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const diffMs = Date.now() - then;
    if (diffMs < 0) return "just now";
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hr ago`;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return "";
  }
}

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
  const lastSyncedAt = useStore((state) => state.account.lastSyncedAt);

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
  const [loadingTreeId, setLoadingTreeId] = useState<string | null>(null);
  const [unavailableTreeIds, setUnavailableTreeIds] = useState<Set<string>>(new Set());
  const [_syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!treesOpen) {
      setEditingId(null);
      setDraft("");
      return;
    }

    let cancelled = false;
    const doSync = async () => {
      try {
        setSyncing(true);
        await syncTrees();
      } catch (error) {
        showOperationError("Sync", error);
      } finally {
        if (!cancelled) {
          setSyncing(false);
        }
      }
    };
    void doSync();

    return () => {
      cancelled = true;
    };
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
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold">trees</span>
              <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {archivedTrees.length}
              </span>
            </div>
          </div>

          <ScrollArea className="max-h-[400px]">
            {/* Active tree section */}
            {activeTree && (
              <div className="py-2.5">
                <div className="px-4 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  current
                </div>
                <div className="flex items-center gap-2.5 px-4 py-2 bg-accent">
                  <div className="min-w-0 flex-1">
                    {editingId === activeTree.id ? (
                      <Input
                        ref={inputRef}
                        className="h-7 text-[13px] px-1.5"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); void commitEdit(); }
                          if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                        }}
                        onBlur={() => void commitEdit()}
                      />
                    ) : (
                      <div
                        className="text-[13px] truncate cursor-text"
                        onDoubleClick={() => startEdit(activeTree)}
                      >
                        {activeTree.label}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {[
                        "active now",
                        `${activeTree.nodeCount} nodes`,
                        lastSyncedAt ? `synced ${formatRelativeTime(lastSyncedAt)}` : null,
                      ].filter(Boolean).join(" \u00b7 ")}
                    </div>
                  </div>
                  {editingId !== activeTree.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        type="button"
                        aria-label="Export tree"
                        data-tooltip="Export tree"
                        onClick={(e) => { e.stopPropagation(); void handleExport(); }}
                      >
                        <Icons.Download />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        type="button"
                        aria-label="Open in editor"
                        data-tooltip="Open in editor"
                        onClick={(e) => { e.stopPropagation(); void openTrailEditor(activeTree.id); }}
                      >
                        <Icons.Pencil />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Saved trees section */}
            <div className="py-2.5">
              <div className="flex items-center justify-between px-4 pb-2 gap-3">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">saved</span>
                <Button
                  id="newTreeBtn"
                  variant="outline"
                  size="icon-xs"
                  type="button"
                  className="rounded-full"
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
              {archivedTrees.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-5 text-muted-foreground">
                  <Icons.ListTree className="size-6 opacity-40" />
                  <span className="text-xs">No saved trees yet</span>
                  <span className="text-[11px] opacity-60">Create a new tree to get started</span>
                </div>
              ) : (
                <div className="px-1">
                  {archivedTrees.map((tree) => {
                    const isLoading = loadingTreeId === tree.id;
                    const isUnavailable = unavailableTreeIds.has(tree.id);
                    const host = formatHost(tree.rootUrl);
                    const date = formatDate(tree.savedAt);
                    const meta = [
                      "archived",
                      tree.stub ? (isUnavailable ? "unavailable" : "cloud") : null,
                      host || tree.rootTitle || "Untitled",
                      `${tree.nodeCount} nodes`,
                      date,
                    ].filter(Boolean).join(" · ");

                    return (
                      <div
                        key={tree.id}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-md px-3 py-2 cursor-pointer hover:bg-accent transition-colors",
                          isLoading && "opacity-60 pointer-events-none",
                          isUnavailable && "opacity-50",
                        )}
                        onClick={() => !isLoading && !isUnavailable && void handleOpen(tree)}
                      >
                        {/* Favicon */}
                        {isLoading ? (
                          <div className="size-4 rounded-sm shrink-0 flex items-center justify-center bg-muted">
                            <Icons.Loader2 className="size-3 animate-spin text-muted-foreground" />
                          </div>
                        ) : tree.stub ? (
                          <div className="size-4 rounded-sm shrink-0 flex items-center justify-center bg-muted">
                            {isUnavailable
                              ? <Icons.CloudOff className="size-3 text-muted-foreground" />
                              : <Icons.Cloud className="size-3 text-muted-foreground" />}
                          </div>
                        ) : tree.rootUrl ? (
                          <img className="size-4 rounded-sm shrink-0" alt="" src={getFaviconUrl(tree.rootUrl)} />
                        ) : (
                          <div className="size-4 rounded-sm shrink-0 flex items-center justify-center bg-muted">
                            <Icons.Bookmark className="size-2.5 text-muted-foreground" />
                          </div>
                        )}

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          {editingId === tree.id ? (
                            <Input
                              ref={inputRef}
                              className="h-7 text-[13px] px-1.5"
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); void commitEdit(); }
                                if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                              }}
                              onBlur={() => void commitEdit()}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <div
                              className="text-[13px] truncate"
                              onDoubleClick={(e) => { e.stopPropagation(); startEdit(tree); }}
                            >
                              {tree.label}
                            </div>
                          )}
                          <div className="text-[11px] text-muted-foreground truncate">{meta}</div>
                        </div>

                        {/* Actions */}
                        {editingId !== tree.id && !isLoading && (
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!tree.stub && (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                type="button"
                                aria-label="Export tree"
                                data-tooltip="Export tree"
                                onClick={(e) => { e.stopPropagation(); void handleExport(tree.id); }}
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
                              onClick={(e) => { e.stopPropagation(); void openTrailEditor(tree.id); }}
                            >
                              <Icons.Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              type="button"
                              aria-label="Delete tree"
                              data-tooltip="Delete tree"
                              disabled={deletePending === tree.id}
                              onClick={(e) => { e.stopPropagation(); void handleDeleteArchived(tree.id); }}
                            >
                              <Icons.Trash2 />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <NewTreeDialog
        open={confirmOpen}
        onOpenChange={(open) => { if (!creating) setConfirmOpen(open); }}
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
            if (e.key === "Enter") { e.preventDefault(); onConfirm(); }
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
