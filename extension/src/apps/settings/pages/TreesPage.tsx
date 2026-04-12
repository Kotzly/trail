import { useState } from "react";
import { useTrees } from "../hooks/useTrees.js";
import { Button } from "@ui/components/ui/button";
import { Card } from "@ui/components/ui/card";
import { Input } from "@ui/components/ui/input";
import { Badge } from "@ui/components/ui/badge";
import { Separator } from "@ui/components/ui/separator";
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
    return <p className="text-sm text-muted-foreground p-4">Loading trees...</p>;
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
      <div>
        <h2 className="text-lg font-semibold">Trees</h2>
        <p className="text-sm text-muted-foreground">
          Manage your browsing trees
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="New tree name..."
          value={newTreeLabel}
          onChange={(e) => setNewTreeLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleNewTree()}
          className="flex-1"
        />
        <Button onClick={handleNewTree} disabled={!newTreeLabel.trim()}>
          New Tree
        </Button>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-medium mb-3">Active</h3>
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{trees.active.label}</span>
              <Badge variant="secondary">Active</Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportTree()}
              >
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={archiveActiveTree}
              >
                Archive
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {trees.archived.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            Archived ({trees.archived.length})
          </h3>
          <div className="flex flex-col gap-2">
            {trees.archived.map((tree) => (
              <Card key={tree.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {editingId === tree.id ? (
                      <div className="flex gap-1">
                        <Input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(tree.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-7 text-sm"
                          autoFocus
                        />
                        <Button size="sm" className="h-7" onClick={() => handleRename(tree.id)}>
                          Save
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <span className="font-medium text-sm">{tree.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {tree.nodeCount} nodes
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openTree(tree.id)}
                    >
                      Open
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingId(tree.id);
                        setEditLabel(tree.label);
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => exportTree(tree.id)}
                    >
                      Export
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{tree.label}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently deletes this tree and all its nodes.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteArchivedTree(tree.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
