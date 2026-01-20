import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { redo, undo } from '../../api/commands.js';
import { createNewTree } from '../../api/tree.js';
import { useStore } from '../state/store.js';
import { Icons } from './Icon.js';
import FloatingSearch from './FloatingSearch.js';
import PinnedDropdown from './PinnedDropdown.js';
import TreeDropdown from './TreeDropdown.js';
import TagFilterDropdown from './tags/TagFilterDropdown.js';
import { createPortal } from 'react-dom';
import React from 'react';

type FloatingControlsProps = {
  searchInputRef: RefObject<HTMLInputElement>;
};

export default function FloatingControls({ searchInputRef }: FloatingControlsProps) {
  const commandState = useStore((state) => state.commandState);
  const metaKey = useStore((state) => state.metaKey);
  const setCommandState = useStore((state) => state.setCommandState);
  const settingsOpen = useStore((state) => state.ui.settingsOpen);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const themePickerOpen = useStore((state) => state.ui.themePickerOpen);
  const setThemePickerOpen = useStore((state) => state.setThemePickerOpen);
  const confirmNewTree = useStore((state) => state.settings?.confirmNewTree ?? true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const [creating, setCreating] = useState(false);

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
      const label = labelDraft.trim() || 'Unnamed Tree';
      setCreating(true);
      await createNewTree(label);
    } catch (error) {
      console.error('Failed to create new tree:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="floating-controls" data-notify-anchor="true">
      <div className="floating-controls-left">
        <div className="floating-island">
          <button
            id="undoBtn"
            className="btn-icon orb-button"
            type="button"
            title={
              commandState?.nextUndoDesc
                ? `Undo: ${commandState.nextUndoDesc} (${undoShortcut})`
                : `Undo (${undoShortcut})`
            }
            disabled={!commandState?.canUndo}
            onClick={handleUndo}
          >
            <Icons.Undo2 size={18} />
          </button>
          <button
            id="redoBtn"
            className="btn-icon orb-button"
            type="button"
            title={
              commandState?.nextRedoDesc
                ? `Redo: ${commandState.nextRedoDesc} (${redoShortcut})`
                : `Redo (${redoShortcut})`
            }
            disabled={!commandState?.canRedo}
            onClick={handleRedo}
          >
            <Icons.Redo2 size={18} />
          </button>
        </div>

        <div className="floating-island">
          <PinnedDropdown />
          <TreeDropdown />
          <TagFilterDropdown />
          <button
            id="newTreeBtn"
            className="btn-icon orb-button"
            type="button"
            title="new tree"
            onClick={() => {
              setLabelDraft('');
              setConfirmOpen(true);
            }}
          >
            <Icons.GitBranchPlus size={18} />
          </button>
        </div>
      </div>

      <div className="floating-controls-right">
        <FloatingSearch inputRef={searchInputRef} />
        <div className="floating-island">
          <button
            id="themePickerBtn"
            className="btn-icon orb-button"
            type="button"
            title="theme"
            onClick={() => setThemePickerOpen(!themePickerOpen)}
          >
            <Icons.Palette size={18} />
          </button>
          <button
            id="settingsBtn"
            className="btn-icon orb-button"
            type="button"
            title="settings"
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <Icons.Settings size={18} />
          </button>
        </div>
      </div>

      <ConfirmOverlay
        open={confirmOpen}
        confirmNewTree={confirmNewTree}
        label={labelDraft}
        creating={creating}
        onLabelChange={setLabelDraft}
        onCancel={() => {
          if (creating) return;
          setConfirmOpen(false);
        }}
        onConfirm={() => {
          if (creating) return;
          setConfirmOpen(false);
          void handleNewTree();
        }}
      />
    </div>
  );
}

type ConfirmOverlayProps = {
  open: boolean;
  confirmNewTree: boolean;
  label: string;
  creating: boolean;
  onLabelChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

function ConfirmOverlay({
  open,
  confirmNewTree,
  label,
  creating,
  onLabelChange,
  onCancel,
  onConfirm,
}: ConfirmOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onCancel, open]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="confirm-overlay"
      onClick={onCancel}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="confirm-dialog"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-title">
          {confirmNewTree ? 'create a new tree?' : 'name your new tree'}
        </div>
        <input
          className="confirm-input"
          type="text"
          value={label}
          placeholder="Unnamed Tree"
          onChange={(event) => onLabelChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onConfirm();
            }
          }}
          autoFocus
        />
        <div className="confirm-actions">
          <button className="confirm-btn ghost" type="button" onClick={onCancel} disabled={creating}>
            Cancel
          </button>
          <button className="confirm-btn" type="button" onClick={onConfirm} disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
