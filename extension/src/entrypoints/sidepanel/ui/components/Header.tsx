import { redo, undo } from '../../api/commands.js';
import { useStore } from '../state/store.js';
import { Icons } from './Icon.js';
import PinnedDropdown from './PinnedDropdown.js';
import TreeDropdown from './TreeDropdown.js';
import TagFilterDropdown from './tags/TagFilterDropdown.js';


export default function Header() {
  const commandState = useStore((state) => state.commandState);
  const metaKey = useStore((state) => state.metaKey);
  const setCommandState = useStore((state) => state.setCommandState);
  const flags = useStore((state) => state.flags);
  const settingsOpen = useStore((state) => state.ui.settingsOpen);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const themePickerOpen = useStore((state) => state.ui.themePickerOpen);
  const setThemePickerOpen = useStore((state) => state.setThemePickerOpen);

  const undoShortcut = metaKey ? `${metaKey.short}+z (${metaKey.long}+z)` : 'Ctrl+Z';
  const redoShortcut = metaKey ? `${metaKey.short}+⇧+z (${metaKey.long}+shift+z)` : 'Ctrl+Shift+Z';
  const settingsShortcut = metaKey ? `${metaKey.short}+,` : 'Ctrl+,';
  const tooltipsShortcut = metaKey ? `${metaKey.short}+/` : 'Ctrl+/';
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
      console.error('Failed to undo:', error);
    }
  };

  const handleRedo = async () => {
    try {
      const state = await redo();
      setCommandState(state);
    } catch (error) {
      console.error('Failed to redo:', error);
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
