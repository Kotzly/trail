import { browser } from "@shared/platform/webext.js";
import { redo, undo } from "../../api/commands.js";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import PinnedDropdown from "./PinnedDropdown.js";
import TreeDropdown from "./TreeDropdown.js";
import { Button } from "@ui/components/ui/button";
import { Separator } from "@ui/components/ui/separator";
import { cn } from "@ui/lib/utils";

type SyncIndicatorState = "syncing" | "offline" | "error" | "idle";

export default function Header() {
  const commandState = useStore((state) => state.commandState);
  const metaKey = useStore((state) => state.metaKey);
  const setCommandState = useStore((state) => state.setCommandState);
  const syncIndicator: SyncIndicatorState = "idle";

  const undoShortcut = metaKey ? `${metaKey.short}+z (${metaKey.long}+z)` : "Ctrl+Z";
  const redoShortcut = metaKey ? `${metaKey.short}+⇧+z (${metaKey.long}+shift+z)` : "Ctrl+Shift+Z";
  const settingsShortcut = metaKey ? `${metaKey.short}+,` : "Ctrl+,";
  const tooltipsShortcut = metaKey ? `${metaKey.short}+/` : "Ctrl+/";
  const undoTooltip = commandState?.nextUndoDesc
    ? `Undo: ${commandState.nextUndoDesc} (${undoShortcut})`
    : `Undo (${undoShortcut})`;
  const redoTooltip = commandState?.nextRedoDesc
    ? `Redo: ${commandState.nextRedoDesc} (${redoShortcut})`
    : `Redo (${redoShortcut})`;
  const settingsLabel = `Settings (${settingsShortcut})`;
  const settingsTooltip = `Settings (${settingsShortcut}) • Tooltips (${tooltipsShortcut})`;

  const handleUndo = async () => {
    try {
      const state = await undo();
      setCommandState(state);
    } catch (error) {
      console.error("Failed to undo:", error);
    }
  };

  const handleRedo = async () => {
    try {
      const state = await redo();
      setCommandState(state);
    } catch (error) {
      console.error("Failed to redo:", error);
    }
  };

  return (
    <header className="flex items-center gap-2 h-12 shrink-0 border-b border-border bg-background px-3">
      <h1 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
        <Icons.Pin className="size-5 text-muted-foreground" aria-hidden="true" />
        trail
      </h1>
      <div className="flex items-center gap-1 ml-auto">
        <Button
          id="undoBtn"
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={undoTooltip}
          data-tooltip={undoTooltip}
          disabled={!commandState?.canUndo}
          onClick={handleUndo}
        >
          <Icons.Undo2 />
        </Button>
        <Button
          id="redoBtn"
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={redoTooltip}
          data-tooltip={redoTooltip}
          disabled={!commandState?.canRedo}
          onClick={handleRedo}
        >
          <Icons.Redo2 />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <PinnedDropdown />
        <TreeDropdown />
        {syncIndicator !== "idle" && (
          <span
            className={cn(
              "inline-flex items-center justify-center size-5 rounded-full",
              syncIndicator === "offline" && "text-yellow-500",
              syncIndicator === "error" && "text-destructive",
              syncIndicator === "syncing" && "text-muted-foreground",
            )}
            aria-label={
              syncIndicator === "syncing" ? "Syncing..." :
              syncIndicator === "offline" ? "Offline" :
              syncIndicator === "error" ? "Sync error" : ""
            }
            data-tooltip={
              syncIndicator === "syncing" ? "Syncing changes..." :
              syncIndicator === "offline" ? "You are offline" :
              syncIndicator === "error" ? "Sync failed" : undefined
            }
          >
            {syncIndicator === "syncing" && <Icons.Loader2 className="size-3.5 animate-spin" />}
            {syncIndicator === "offline" && <Icons.CloudOff className="size-3.5" />}
            {syncIndicator === "error" && <Icons.AlertTriangle className="size-3.5" />}
          </span>
        )}
        <Button
          id="settingsBtn"
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={settingsLabel}
          data-tooltip={settingsTooltip}
          onClick={() => {
            const url = chrome.runtime.getURL("settings.html");
            browser.tabs.create({ url, active: true }).catch((error) => {
              console.error("Failed to open hub page:", error);
            });
          }}
        >
          <Icons.Settings />
        </Button>
      </div>
    </header>
  );
}
