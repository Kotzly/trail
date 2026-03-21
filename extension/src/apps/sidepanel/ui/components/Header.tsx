import { redo, undo } from "../../api/commands.js";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import PinnedDropdown from "./PinnedDropdown.js";
import TreeDropdown from "./TreeDropdown.js";
import TagFilterDropdown from "./tags/TagFilterDropdown.js";

type SyncIndicatorState = "syncing" | "offline" | "error" | "idle";

export default function Header() {
  const commandState = useStore((state) => state.commandState);
  const metaKey = useStore((state) => state.metaKey);
  const setCommandState = useStore((state) => state.setCommandState);
  const flags = useStore((state) => state.flags);
  const settingsOpen = useStore((state) => state.ui.settingsOpen);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const themePickerOpen = useStore((state) => state.ui.themePickerOpen);
  const setThemePickerOpen = useStore((state) => state.setThemePickerOpen);
  const syncStatus = useStore((state) => state.syncStatus);
  const network = useStore((state) => state.account.network);

  const syncIndicator: SyncIndicatorState =
    network === "offline" ? "offline" :
    syncStatus === "error" ? "error" :
    syncStatus === "saving" ? "syncing" :
    "idle";

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
    <header className="header">
      <h1 className="title">
        <Icons.Pin className="logo" aria-hidden="true" size={20} />
        trail
      </h1>
      <div className="header-actions">
        <button
          id="undoBtn"
          className="matte-circle-btn orb-button"
          type="button"
          aria-label={undoTooltip}
          data-tooltip={undoTooltip}
          disabled={!commandState?.canUndo}
          onClick={handleUndo}
        >
          <Icons.Undo2 size={20} />
        </button>
        <button
          id="redoBtn"
          className="matte-circle-btn orb-button"
          type="button"
          aria-label={redoTooltip}
          data-tooltip={redoTooltip}
          disabled={!commandState?.canRedo}
          onClick={handleRedo}
        >
          <Icons.Redo2 size={20} />
        </button>
        <div className="header-divider" />
        <PinnedDropdown />
        <TreeDropdown />
        <TagFilterDropdown />
        {flags?.themeStudio && (
          <button
            id="themePickerBtn"
            className="matte-circle-btn orb-button"
            type="button"
            aria-label="Theme"
            data-tooltip="Theme"
            onClick={() => setThemePickerOpen(!themePickerOpen)}
          >
            <Icons.Palette size={20} />
          </button>
        )}
        {syncIndicator !== "idle" && (
          <span
            className="sync-indicator"
            data-state={syncIndicator}
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
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              borderRadius: "50%",
              color: syncIndicator === "offline" ? "var(--color-warning, #f59e0b)" :
                     syncIndicator === "error" ? "var(--color-error, #ef4444)" :
                     "var(--color-text-secondary, #888)",
              opacity: 0.85,
            }}
          >
            {syncIndicator === "syncing" && (
              <Icons.Loader2
                size={14}
                style={{ animation: "sync-indicator-spin 1s linear infinite" }}
              />
            )}
            {syncIndicator === "offline" && <Icons.CloudOff size={14} />}
            {syncIndicator === "error" && <Icons.AlertTriangle size={14} />}
          </span>
        )}
        <button
          id="settingsBtn"
          className="matte-circle-btn orb-button"
          type="button"
          aria-label={settingsLabel}
          data-tooltip={settingsTooltip}
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          <Icons.Settings size={20} />
        </button>
      </div>
    </header>
  );
}
