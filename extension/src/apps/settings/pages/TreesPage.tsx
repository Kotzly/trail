import { memo, useCallback, useState } from "react";
import { useTrees } from "../hooks/useTrees.js";
import { Button } from "@ui/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import { Input } from "@ui/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@ui/components/ui/input-group";
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
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@ui/components/ui/item";
import { Skeleton } from "@ui/components/ui/skeleton";
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
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Archive02Icon,
  BookmarkIcon,
  Delete02Icon,
  Download04Icon,
  Folder01Icon,
  ListTreeIcon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import type { ArchiveIndexEntry } from "@shared/types/tree.js";

export function TreesPage() {
  const {
    trees,
    loading,
    newTree,
    openTree,
    renameTree,
    archiveActiveTree,
    deleteArchivedTree,
    exportTree,
  } = useTrees();

  const [newTreeLabel, setNewTreeLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleNewTree = useCallback(async () => {
    if (!newTreeLabel.trim()) return;
    await newTree(newTreeLabel.trim());
    setNewTreeLabel("");
  }, [newTreeLabel, newTree]);

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
    return <TreesSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <CardHeader className="px-0">
        <CardTitle>Trees</CardTitle>
        <CardDescription>Manage your browsing trees.</CardDescription>
      </CardHeader>

      <InputGroup>
        <InputGroupInput
          placeholder="New tree name…"
          value={newTreeLabel}
          onChange={(e) => setNewTreeLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleNewTree();
          }}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton onClick={() => void handleNewTree()} disabled={!newTreeLabel.trim()}>
            <HugeiconsIcon icon={PlusSignIcon} />
            Create
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <ItemGroup>
        <Item variant="muted" size="sm">
          <ItemMedia variant="icon">
            <HugeiconsIcon icon={BookmarkIcon} className="text-muted-foreground" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{trees.active.label}</ItemTitle>
            <ItemDescription>Currently open in the sidepanel.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Export tree"
              data-tooltip="Export tree"
              onClick={() => void exportTree()}
            >
              <HugeiconsIcon icon={Download04Icon} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Archive tree"
              data-tooltip="Archive tree"
              onClick={() => void archiveActiveTree()}
            >
              <HugeiconsIcon icon={Archive02Icon} />
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>

      {trees.archived.length === 0 ? (
        <EmptyArchived />
      ) : (
        <ItemGroup>
          {trees.archived.map((tree) => (
            <ArchivedTreeRow
              key={tree.id}
              tree={tree}
              isEditing={editingId === tree.id}
              onStartEdit={handleStartEdit}
              onCancelEdit={handleCancelEdit}
              onCommitRename={handleCommitRename}
              onOpen={openTree}
              onExport={exportTree}
              onDelete={deleteArchivedTree}
            />
          ))}
        </ItemGroup>
      )}
    </div>
  );
}

/* ─── Subcomponents ──────────────────────────────────────────────── */

/** Hoisted so the parent re-render doesn't reconstruct static JSX. */
function TreesSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-56" />
      </div>
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

function EmptyArchived() {
  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={ListTreeIcon} />
        </EmptyMedia>
        <EmptyTitle>No archived trees</EmptyTitle>
        <EmptyDescription>
          Archive the current tree to save it here. You can re-open archived trees from the
          sidepanel switcher.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

type ArchivedTreeRowProps = {
  tree: ArchiveIndexEntry;
  isEditing: boolean;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onCommitRename: (id: string, nextLabel: string) => void | Promise<void>;
  onOpen: (id: string) => void | Promise<void>;
  onExport: (id?: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
};

/**
 * Explicit variant: archived-tree row. Splits into view/edit children so
 * typing in one row never re-renders siblings (`rerender-memo`).
 */
const ArchivedTreeRow = memo(function ArchivedTreeRow({
  tree,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onCommitRename,
  onOpen,
  onExport,
  onDelete,
}: ArchivedTreeRowProps) {
  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <HugeiconsIcon icon={Folder01Icon} className="text-muted-foreground" />
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
          <Button variant="ghost" size="sm" onClick={() => void onOpen(tree.id)}>
            Open
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Rename"
            data-tooltip="Rename"
            onClick={() => onStartEdit(tree.id)}
          >
            <HugeiconsIcon icon={PencilEdit02Icon} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Export"
            data-tooltip="Export"
            onClick={() => void onExport(tree.id)}
          >
            <HugeiconsIcon icon={Download04Icon} />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="icon-sm"
                aria-label="Delete"
                data-tooltip="Delete"
              >
                <HugeiconsIcon icon={Delete02Icon} />
              </Button>
            </AlertDialogTrigger>
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

/**
 * Inline rename input with its own draft state. Mounting only while
 * editing means keystrokes here never cause sibling rows to re-render.
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
