import type { RefObject } from 'react';
import { redo, undo } from '../../api/commands.js';
import { clearTree as newTree } from '../../api/tree.js';
import { useStore } from '../state/store.js';
import { Icons } from './Icon.js';
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

  const handleNewTree = async () => {
    try {
      await newTree();
    } catch (error) {
      console.error('Failed to create new tree:', error);
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
          <Icons.Undo2 size={20} />
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
          <Icons.Redo2 size={20} />
        </button>
        <div className="header-divider" />
        <PinnedDropdown />
        <button id="newTreeBtn" className="btn-icon" type="button" title="new tree" onClick={handleNewTree}>
          <Icons.GitBranchPlus size={20} />
        </button>
        <button
          id="settingsBtn"
          className="btn-icon"
          type="button"
          title="settings"
          ref={settingsBtnRef}
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          <Icons.Settings size={20} />
        </button>
      </div>
    </header>
  );
}
