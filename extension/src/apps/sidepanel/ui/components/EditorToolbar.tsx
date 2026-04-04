import { useState } from "react";
import { rpc } from "@shared/rpc/contracts.js";
import { sendMessage } from "../../api/background.js";
import { Icons } from "./Icon.js";
import { useStore } from "../state/store.js";

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
    <div className="editor-toolbar">
      <div className="editor-toolbar__status">
        <Icons.Pencil size={14} />
        <span className="editor-toolbar__label">
          editing{isSaving ? " — saving…" : ""}
        </span>
      </div>
      <div className="editor-toolbar__actions">
        <button
          type="button"
          className="editor-toolbar__btn editor-toolbar__btn--cancel"
          onClick={() => void handleAction("cancel")}
          disabled={busy}
          aria-label="Cancel editing (discard changes)"
        >
          <Icons.X size={14} />
          <span>discard</span>
        </button>
        <button
          type="button"
          className="editor-toolbar__btn editor-toolbar__btn--save"
          onClick={() => void handleAction("save")}
          disabled={busy}
          aria-label="Save and exit editing"
        >
          <Icons.Check size={14} />
          <span>done</span>
        </button>
      </div>
    </div>
  );
}
