import { useState } from "react";
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
import { Input } from "@ui/components/ui/input";
import { Label } from "@ui/components/ui/label";
import { useBoolean } from "@ui/hooks/use-boolean";
import { useLockFn } from "@ui/hooks/use-lock-fn";
import { useStore } from "../state/store.js";
import { renameNode } from "../../api/tree.js";
import { showOperationError } from "../shared/show-operation-error.js";
import { captureEvent } from "@shared/lib/observability.js";
import type { NodeId } from "@shared/types/ids.js";

/**
 * Outer component only owns the "is a dialog open?" state so we can key the
 * inner form on `renameTarget`. That lets us reset the input field via
 * React's key-based remount instead of syncing derived state in an effect.
 */
export default function RenameNodeDialog() {
  const renameTarget = useStore((s) => s.renameTarget);
  const closeRename = useStore((s) => s.closeRenameDialog);

  return (
    <AlertDialog
      open={Boolean(renameTarget)}
      onOpenChange={(open) => {
        if (!open) closeRename();
      }}
    >
      {renameTarget ? (
        <AlertDialogContent>
          <RenameForm key={String(renameTarget)} nodeId={renameTarget} onClose={closeRename} />
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}

function RenameForm({ nodeId, onClose }: { nodeId: NodeId; onClose: () => void }) {
  const tree = useStore((s) => s.tree);
  const initialTitle = String(tree?.findNodeById(nodeId)?.data.title ?? "");
  const [value, setValue] = useState(initialTitle);
  const [submitting, submittingActions] = useBoolean(false);

  const handleSubmit = useLockFn(async () => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    submittingActions.setTrue();
    try {
      await renameNode(nodeId, trimmed);
      captureEvent("node_renamed");
      onClose();
    } catch (error) {
      showOperationError("Rename node", error);
    } finally {
      submittingActions.setFalse();
    }
  });

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Rename node</AlertDialogTitle>
        <AlertDialogDescription>
          Give this node a new title. The URL stays the same.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="flex flex-col gap-2"
      >
        <Label htmlFor="rename-input" className="text-xs">
          Title
        </Label>
        <Input
          id="rename-input"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Node title"
          maxLength={500}
        />
      </form>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          disabled={submitting || value.trim().length === 0}
          onClick={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          {submitting ? "Renaming…" : "Rename"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
