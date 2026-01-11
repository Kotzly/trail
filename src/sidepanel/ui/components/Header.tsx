import type { RefObject } from 'react';
import { redo, undo } from '../../api/commands.js';
import { clearTree } from '../../api/tree.js';
import { useStore } from '../state/store.js';
import PinnedDropdown from './PinnedDropdown.js';
import React from 'react';

type HeaderProps = {
  settingsBtnRef: RefObject<HTMLButtonElement>;
};

export default function Header({ settingsBtnRef }: HeaderProps) {
  const commandState = useStore((state) => state.commandState);
  const metaKey = useStore((state) => state.metaKey);
  const setCommandState = useStore((state) => state.setCommandState);
  const settingsOpen = useStore((state) => state.ui.settingsOpen);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);

  const undoShortcut = metaKey ? `${metaKey.short}+z (${metaKey.long}+z)` : 'Ctrl+Z';
  const redoShortcut = metaKey ? `${metaKey.short}+⇧+z (${metaKey.long}+shift+z)` : 'Ctrl+Shift+Z';

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

  const handleClear = async () => {
    try {
      await clearTree();
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  return (
    <header className="header">
      <h1 className="title">
        <svg
          className="logo"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v9" />
          <path d="M12 12l-5 9" />
          <path d="M12 12l5 9" />
          <circle cx="12" cy="3" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="7" cy="21" r="1.5" fill="currentColor" />
          <circle cx="17" cy="21" r="1.5" fill="currentColor" />
        </svg>
        trail
      </h1>
      <div className="header-actions">
        <button
          id="undoBtn"
          className="btn-icon"
          type="button"
          title={
            commandState?.nextUndoDesc
              ? `Undo: ${commandState.nextUndoDesc} (${undoShortcut})`
              : `Undo (${undoShortcut})`
          }
          disabled={!commandState?.canUndo}
          onClick={handleUndo}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6" />
            <path d="M3 13a9 9 0 0 1 15.36-6.36" />
          </svg>
        </button>
        <button
          id="redoBtn"
          className="btn-icon"
          type="button"
          title={
            commandState?.nextRedoDesc
              ? `Redo: ${commandState.nextRedoDesc} (${redoShortcut})`
              : `Redo (${redoShortcut})`
          }
          disabled={!commandState?.canRedo}
          onClick={handleRedo}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 7v6h-6" />
            <path d="M21 13a9 9 0 0 0-15.36-6.36" />
          </svg>
        </button>
        <div className="header-divider" />
        <PinnedDropdown />
        <button id="clearBtn" className="btn-icon" type="button" title="clear tree" onClick={handleClear}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
        <button
          id="settingsBtn"
          className="btn-icon"
          type="button"
          title="settings"
          ref={settingsBtnRef}
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
