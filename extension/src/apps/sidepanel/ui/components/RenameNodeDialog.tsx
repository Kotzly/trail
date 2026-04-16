import { useEffect, useState } from "react";
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
import { useStore } from "../state/store.js";
import { renameNode } from "../../api/tree.js";
import { showOperationError } from "../shared/show-operation-error.js";
import { captureEvent } from "@shared/lib/observability.js";

export default function RenameNodeDialog() {
  const renameTarget = useStore((s) => s.renameTarget);
  const closeRename = useStore((s) => s.closeRenameDialog);
  const tree = useStore((s) => s.tree);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const node = renameTarget ? tree?.findNodeById(renameTarget) : null;

  useEffect(() => {
    if (node) {
      setValue(String(node.data.title ?? ""));
    } else {
      setValue("");
    }
  }, [node]);

  const handleSubmit = async () => {
    if (!renameTarget) return;
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    setSubmitting(true);
    try {
      await renameNode(renameTarget, trimmed);
      captureEvent("node_renamed");
      closeRename();
    } catch (error) {
      showOperationError("Rename node", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog
      open={Boolean(renameTarget)}
      onOpenChange={(open) => {
        if (!open) closeRename();
      }}
    >
      <AlertDialogContent>
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
      </AlertDialogContent>
    </AlertDialog>
  );
}
