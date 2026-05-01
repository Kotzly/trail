import { memo, useCallback, useMemo, useRef, useState } from "react";
import { i18n } from "#i18n";
import {
  createNewTree,
  ensureTreeLoaded,
  exportTree,
  importTrail,
  openTree,
  renameTree,
} from "../../api/tree.js";
import { useDeleteFlow } from "../hooks/useDeleteFlow.js";
import { useStore } from "../state/store.js";
import { useOverlayEffects } from "../state/overlay-effects.js";
import { cn } from "@ui/lib/utils";
import { Icons } from "./Icon.js";

import type { FaviconUrl, Title, Url } from "@shared/types/ids.js";
import { getFaviconUrl } from "@shared/utils/favicon.js";
import { EXPORT_SCHEMA, type TrailExportBundle } from "@shared/types/export.js";
import { toast } from "sonner";
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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@ui/components/ui/item";
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

  const allTrees = useMemo<Array<TreeItem & { active: boolean }>>(() => {
    const active = trees.active
      ? [
          {
            id: trees.active.id,
            label: trees.active.label,
            nodeCount,
            active: true,
          } as TreeItem & { active: boolean },
        ]
      : [];
    const others = [...trees.others]
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
      .map((entry) => {
        const item: TreeItem & { active: boolean } = {
          id: entry.id,
          label: entry.label,
          nodeCount: entry.nodeCount,
          savedAt: entry.savedAt,
          active: false,
          ...(entry.rootUrl != null && { rootUrl: entry.rootUrl }),
          ...(entry.rootTitle != null && { rootTitle: entry.rootTitle }),
          ...(entry.rootFavicon != null && { rootFavicon: entry.rootFavicon }),
        };
        if ("stub" in entry && (entry as { stub?: boolean }).stub) {
          item.stub = true;
        }
        return item;
      });
    return [...active, ...others];
  }, [trees.active, trees.others, nodeCount]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmOpen, confirmOpenActions] = useBoolean(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [deletePending, setDeletePending] = useState<string | null>(null);
  const { request: requestDelete } = useDeleteFlow();
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
      showOperationError(i18n.t("sidepanel.operations.rename"), error);
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
          showOperationError(i18n.t("sidepanel.operations.loadTreeFromCloud"), loadError);
          setUnavailableTreeIds((prev) => new Set(prev).add(tree.id));
          setLoadingTreeId(null);
          return;
        }
      }
      try {
        await openTree(tree.id);
      } catch (openError) {
        showOperationError(i18n.t("sidepanel.operations.openTree"), openError);
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
        await requestDelete({ kind: "tree", treeId }, { source: "trash-icon" });
      } finally {
        setDeletePending(null);
      }
    },
    [deletePending, requestDelete],
  );

  const handleExport = useCallback(async (treeId?: string) => {
    try {
      const bundle = await exportTree(treeId);
      downloadBundle(bundle);
      toast.success(i18n.t("sidepanel.treesDropdown.exportedToast"));
    } catch (error) {
      showOperationError(i18n.t("sidepanel.operations.export"), error);
    }
  }, []);

  const handleNewTree = useLockFn(async () => {
    try {
      const label = labelDraft.trim() || i18n.t("sidepanel.treesDropdown.unnamedTree");
      creatingActions.setTrue();
      await createNewTree(label);
    } catch (error) {
      showOperationError(i18n.t("sidepanel.operations.createTree"), error);
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
        toast.error(i18n.t("sidepanel.treesDropdown.unsupportedFile"));
        return;
      }
      await importTrail(bundle);
      setTreesOpen(false);
      toast.success(i18n.t("sidepanel.treesDropdown.importedToast"));
    } catch (error) {
      showOperationError(i18n.t("sidepanel.operations.import"), error);
    } finally {
      importingActions.setFalse();
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  });

  const totalCount = allTrees.length;
  const showSearch = totalCount > SEARCH_THRESHOLD;
  const isEmpty = totalCount === 0;

  return (
    <>
      <Popover open={treesOpen} onOpenChange={handlePopoverOpenChange}>
        <ButtonTooltip label={i18n.t("sidepanel.treesDropdown.label")} keys={TREES_KEYS}>
          <PopoverTrigger asChild>
            <Button
              id="treesBtn"
              variant="secondary"
              size="icon"
              type="button"
              aria-label={i18n.t("sidepanel.treesDropdown.label")}
              className="press-feedback"
            >
              <Icons.ListTree />
            </Button>
          </PopoverTrigger>
        </ButtonTooltip>
        <PopoverContent
          align="start"
          className="flex max-h-[min(var(--radix-popover-content-available-height),640px)] w-[360px] flex-col gap-0 overflow-hidden p-0 data-closed:duration-[100ms] data-closed:ease-(--ease-out) data-open:duration-(--dur-base) data-open:ease-(--ease-out)"
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
                <span className="text-[13px] font-medium">{i18n.t("trees.title")}</span>
                <span className="text-muted-foreground text-[11px]">
                  {totalCount}{" "}
                  {totalCount === 1
                    ? i18n.t("sidepanel.treesDropdown.treeCountOne")
                    : i18n.t("sidepanel.treesDropdown.treeCountMany")}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".trail.json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImportFile(file);
                  }}
                />
                <ButtonTooltip label={i18n.t("sidepanel.treesDropdown.import")}>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    type="button"
                    aria-label={i18n.t("sidepanel.treesDropdown.import")}
                    disabled={importing}
                    onClick={() => fileInputRef.current?.click()}
                    className="press-feedback"
                  >
                    {importing ? <Spinner /> : <Icons.Download />}
                  </Button>
                </ButtonTooltip>
                <ButtonTooltip label={i18n.t("trees.newTree")}>
                  <Button
                    id="newTreeBtn"
                    variant="ghost"
                    size="icon-xs"
                    type="button"
                    aria-label={i18n.t("trees.newTree")}
                    onClick={() => {
                      setLabelDraft("");
                      closeAllPopups();
                      confirmOpenActions.setTrue();
                    }}
                    className="press-feedback"
                  >
                    <Icons.GitBranchPlus />
                  </Button>
                </ButtonTooltip>
              </div>
            </header>

            {showSearch && (
              <CommandInput
                placeholder={i18n.t("sidepanel.treesDropdown.searchPlaceholder")}
                className="placeholder:text-muted-foreground/70"
              />
            )}

            {isEmpty ? (
              <EmptyState />
            ) : (
              <CommandList className="max-h-none min-h-0 flex-1 overflow-y-auto">
                <CommandEmpty className="text-muted-foreground py-6 text-center text-xs">
                  {i18n.t("sidepanel.treesDropdown.noMatches")}
                </CommandEmpty>

                <CommandGroup className="p-1">
                  {allTrees.map((tree) => (
                    <TreeRow
                      key={tree.id}
                      tree={tree}
                      syncedAt={tree.active ? lastSyncedAt : null}
                      isEditing={editingId === tree.id}
                      loading={loadingTreeId === tree.id}
                      unavailable={unavailableTreeIds.has(tree.id)}
                      deleting={deletePending === tree.id}
                      onStartEdit={handleStartEdit}
                      onCommitRename={handleCommitRename}
                      onCancelEdit={handleCancelEdit}
                      onOpen={handleOpen}
                      onExport={handleExport}
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

/* ─── Row primitive ──────────────────────────────────────────────── */

type TreeRowProps = {
  tree: TreeItem & { active: boolean };
  syncedAt: string | null;
  isEditing: boolean;
  loading: boolean;
  unavailable: boolean;
  deleting: boolean;
  onStartEdit: (id: string) => void;
  onCommitRename: (id: string, nextLabel: string) => void | Promise<void>;
  onCancelEdit: () => void;
  onOpen: (tree: TreeItem) => void;
  onExport: (treeId?: string) => void;
  onDelete: (treeId: string) => void;
};

const TreeRow = memo(function TreeRow({
  tree,
  syncedAt,
  isEditing,
  loading,
  unavailable,
  deleting,
  onStartEdit,
  onCommitRename,
  onCancelEdit,
  onOpen,
  onExport,
  onDelete,
}: TreeRowProps) {
  const clickable = !tree.active && !loading && !unavailable && !isEditing;
  const metaParts = tree.active
    ? [
        formatNodeCount(tree.nodeCount),
        syncedAt
          ? i18n.t("sidepanel.treesDropdown.metaSynced", [formatRelativeTime(syncedAt)])
          : i18n.t("sidepanel.treesDropdown.metaActiveNow"),
      ]
    : [
        tree.stub
          ? unavailable
            ? i18n.t("sidepanel.treesDropdown.metaUnavailable")
            : i18n.t("sidepanel.treesDropdown.metaCloud")
          : null,
        formatHost(tree.rootUrl),
        formatNodeCount(tree.nodeCount),
        formatDate(tree.savedAt),
      ];
  const meta = metaParts.filter(Boolean).join(" · ");
  const searchValue = `${tree.id} ${tree.label} ${formatHost(tree.rootUrl) ?? ""}`;

  return (
    <CommandPrimitive.Item
      asChild
      value={searchValue}
      onSelect={clickable ? () => void onOpen(tree) : undefined}
      disabled={!clickable}
    >
      <Item
        size="xs"
        variant={tree.active ? "muted" : "default"}
        className={cn(
          "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground rounded-inner transition-colors",
          clickable && "cursor-pointer",
          loading && "opacity-60",
          unavailable && "opacity-50",
        )}
      >
        <ItemMedia variant="icon" className="opacity-80">
          <TreeFavicon tree={tree} loading={loading} unavailable={unavailable} />
        </ItemMedia>
        <ItemContent>
          {isEditing ? (
            <RenameField
              initial={tree.label}
              onCommit={(next) => void onCommitRename(tree.id, next)}
              onCancel={onCancelEdit}
            />
          ) : (
            <ItemTitle>
              {displayLabel({
                label: tree.label,
                ...(tree.rootTitle ? { rootTitle: tree.rootTitle } : {}),
                ...(tree.rootUrl ? { rootUrl: tree.rootUrl } : {}),
              })}
            </ItemTitle>
          )}
          {meta && !isEditing ? (
            <ItemDescription className="text-[11px] text-current opacity-60">
              {meta}
            </ItemDescription>
          ) : null}
        </ItemContent>
        {!isEditing && !loading && (
          <ItemActions
            className={cn(
              "gap-0.5 transition-opacity focus-within:opacity-100",
              !tree.active &&
                "opacity-0 group-hover/item:opacity-100 group-data-[selected=true]/item:opacity-100",
            )}
          >
            <IconAction
              label={i18n.t("trees.actions.rename")}
              icon={<Icons.Pencil />}
              onClick={() => onStartEdit(tree.id)}
            />
            {!tree.stub && (
              <IconAction
                label={i18n.t("trees.actions.exportTree")}
                icon={<Icons.Upload />}
                onClick={() => onExport(tree.active ? undefined : tree.id)}
              />
            )}
            {!tree.active && (
              <IconAction
                label={i18n.t("menus.deleteTree")}
                icon={<Icons.Trash2 />}
                disabled={deleting}
                onClick={() => onDelete(tree.id)}
              />
            )}
          </ItemActions>
        )}
      </Item>
    </CommandPrimitive.Item>
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
    const trimmed = draft.trim() || i18n.t("sidepanel.treesDropdown.unnamedTree");
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
        className="press-feedback opacity-60 hover:opacity-100"
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
    return <Spinner className="size-4 opacity-60" />;
  }
  if (tree.stub) {
    return unavailable ? (
      <Icons.CloudOff className="size-4 opacity-60" />
    ) : (
      <Icons.Cloud className="size-4 opacity-60" />
    );
  }
  if (tree.rootUrl) {
    return <img className="size-4" alt="" src={getFaviconUrl(tree.rootUrl)} />;
  }
  return <Icons.Bookmark className="size-4 opacity-60" />;
}

function EmptyState() {
  return (
    <Empty className="border-0 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icons.ListTree />
        </EmptyMedia>
        <EmptyTitle className="text-sm">{i18n.t("sidepanel.treesDropdown.emptyTitle")}</EmptyTitle>
        <EmptyDescription>{i18n.t("sidepanel.treesDropdown.emptyDescription")}</EmptyDescription>
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
      <DialogContent
        className="max-w-xs data-closed:duration-(--dur-fast) data-closed:ease-(--ease-out) data-open:duration-(--dur-medium) data-open:ease-(--ease-out)"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-normal">
            {confirmNewTree
              ? i18n.t("trees.createDialog.title")
              : i18n.t("sidepanel.treesDropdown.newTreeNameTitle")}
          </DialogTitle>
        </DialogHeader>
        <Input
          type="text"
          value={label}
          placeholder={i18n.t("sidepanel.treesDropdown.unnamedTree")}
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
            className="press-feedback"
          >
            {i18n.t("trees.createDialog.cancel")}
          </Button>
          <Button
            size="sm"
            type="button"
            onClick={onConfirm}
            disabled={creating}
            className="press-feedback"
          >
            {creating ? i18n.t("trees.createDialog.creating") : i18n.t("trees.createDialog.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
