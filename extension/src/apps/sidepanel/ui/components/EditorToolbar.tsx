import { useState } from "react";
import { rpc } from "@shared/rpc/contracts.js";
import { sendMessage } from "../../api/background.js";
import { Icons } from "./Icon.js";
import { useStore } from "../state/store.js";
import { Button } from "@ui/components/ui/button";

export default function EditorToolbar() {
  const editorActive = useStore((state) => state.editorMode.active);
  const syncStatus = useStore((state) => state.syncStatus);
  const [busy, setBusy] = useState(false);

  if (!editorActive) return null;

  const isSaving = syncStatus === "saving";

  const handleAction = async (action: "save" | "cancel") => {
    if (busy) return;
    setBusy(true);
    try {
      await sendMessage(action === "save" ? rpc.exitEditorMode() : rpc.cancelEditorMode());
    } catch (error) {
      console.error(`Failed to ${action} editor:`, error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-blue-500/10 border-b border-blue-500/30 z-[910] shrink-0 animate-in slide-in-from-top duration-200">
      <div className="flex items-center gap-1.5 text-blue-300 text-xs font-medium min-w-0">
        <Icons.Pencil className="size-3.5" />
        <span className="truncate">
          editing{isSaving ? " — saving…" : ""}
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="ghost"
          size="xs"
          type="button"
          onClick={() => void handleAction("cancel")}
          disabled={busy}
          aria-label="Cancel editing (discard changes)"
        >
          <Icons.X data-icon="inline-start" />
          discard
        </Button>
        <Button
          variant="default"
          size="xs"
          type="button"
          onClick={() => void handleAction("save")}
          disabled={busy}
          aria-label="Save and exit editing"
        >
          <Icons.Check data-icon="inline-start" />
          done
        </Button>
      </div>
    </div>
  );
}
