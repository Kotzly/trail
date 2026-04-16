import { useState } from "react";
import { useTrees } from "../hooks/useTrees.js";
import { Button } from "@ui/components/ui/button";
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
  ListTreeIcon,
  PlusSignIcon,
  Delete02Icon,
  PencilEdit02Icon,
  Download04Icon,
  Folder01Icon,
} from "@hugeicons/core-free-icons";

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
  const [editLabel, setEditLabel] = useState("");

  if (loading || !trees) {
    return <p className="text-muted-foreground p-4 text-sm">Loading trees…</p>;
  }

  const handleNewTree = async () => {
    if (!newTreeLabel.trim()) return;
    await newTree(newTreeLabel.trim());
    setNewTreeLabel("");
  };

  const handleRename = async (treeId: string) => {
    if (!editLabel.trim()) return;
    await renameTree(treeId, editLabel.trim());
    setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Trees</h2>
        <p className="text-muted-foreground text-sm">Manage your browsing trees.</p>
      </header>

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

      <section className="flex flex-col gap-2">
        <h3 className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          Active
        </h3>
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
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          Archived{trees.archived.length > 0 ? ` · ${trees.archived.length}` : ""}
        </h3>
        {trees.archived.length === 0 ? (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={ListTreeIcon} />
              </EmptyMedia>
              <EmptyTitle className="text-sm">No archived trees</EmptyTitle>
              <EmptyDescription>
                Archive the current tree to save it here. You can re-open archived trees from the
                sidepanel switcher.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup>
            {trees.archived.map((tree) => {
              const isEditing = editingId === tree.id;
              return (
                <Item key={tree.id} variant="outline" size="sm">
                  <ItemMedia variant="icon">
                    <HugeiconsIcon icon={Folder01Icon} className="text-muted-foreground" />
                  </ItemMedia>
                  <ItemContent>
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(tree.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={() => {
                          if (editLabel.trim() && editLabel !== tree.label) {
                            void handleRename(tree.id);
                          } else {
                            setEditingId(null);
                          }
                        }}
                        className="h-7 max-w-sm"
                      />
                    ) : (
                      <ItemTitle
                        className="cursor-text"
                        onDoubleClick={() => {
                          setEditingId(tree.id);
                          setEditLabel(tree.label);
                        }}
                      >
                        {tree.label}
                      </ItemTitle>
                    )}
                    <ItemDescription>{tree.nodeCount.toLocaleString()} nodes</ItemDescription>
                  </ItemContent>
                  {!isEditing && (
                    <ItemActions>
                      <Button variant="ghost" size="sm" onClick={() => void openTree(tree.id)}>
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Rename"
                        data-tooltip="Rename"
                        onClick={() => {
                          setEditingId(tree.id);
                          setEditLabel(tree.label);
                        }}
                      >
                        <HugeiconsIcon icon={PencilEdit02Icon} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Export"
                        data-tooltip="Export"
                        onClick={() => void exportTree(tree.id)}
                      >
                        <HugeiconsIcon icon={Download04Icon} />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete"
                            data-tooltip="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <HugeiconsIcon icon={Delete02Icon} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete &ldquo;{tree.label}&rdquo;?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes the tree and all its nodes. This cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => void deleteArchivedTree(tree.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </ItemActions>
                  )}
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </section>
    </div>
  );
}
