import { useEffect } from "react";
import { rpc } from "@shared/rpc/contracts.js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ui/components/ui/alert-dialog";
import { fireAndForget } from "../../api/background.js";
import { createNewTree } from "../../api/tree.js";
import { useOverlayEffects } from "../state/overlay-effects.js";
import { useStore } from "../state/store.js";

const DEFAULT_NEW_TREE_LABEL = "Unnamed Tree";

export default function DeleteTreeConfirmModal() {
  const { open, rootId } = useStore((state) => state.deleteTreeConfirm);
  const tree = useStore((state) => state.tree);
  const clearSelection = useStore((state) => state.clearSelection);
  const close = useStore((state) => state.closeDeleteTreeConfirm);
  const treeLabel = useStore((state) => state.trees.active?.label ?? "this tree");
  const nodeCount = useStore((state) => state.nodeCount);

  useOverlayEffects(open, { lod: true, blur: true, kind: "modal" });

  const currentRootId = tree?.getRoot?.()?.id ?? null;
  const canAct = open && rootId !== null && rootId === currentRootId;

  useEffect(() => {
    if (!open) return;
    if (canAct) return;
    close();
  }, [canAct, close, open]);

  const handleDelete = () => {
    if (!canAct || !rootId) return;
    clearSelection();
    fireAndForget(rpc.deleteWithChildren({ nodeId: rootId }));
  };

  const handleCreateNewTree = () => {
    clearSelection();
    void createNewTree(DEFAULT_NEW_TREE_LABEL);
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) close(); }}>
      <AlertDialogContent className="max-w-xs gap-3 p-4">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">
            Delete &ldquo;{treeLabel}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            This removes all {nodeCount} page{nodeCount === 1 ? "" : "s"} in this tree. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel className="mt-0 flex-1" size="sm">Cancel</AlertDialogCancel>
          <AlertDialogAction variant="outline" size="sm" className="flex-1" onClick={handleCreateNewTree}>
            New tree
          </AlertDialogAction>
          <AlertDialogAction variant="destructive" size="sm" className="flex-1" onClick={handleDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
