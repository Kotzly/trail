import React, { useEffect, useRef } from 'react';
import { useStore } from '../state/store.js';
import { Icons } from './Icon.js';
import { sendMessage } from '../../api/background.js';
import { msg } from '../../../shared/types/messages.js';

export default function EditorToolbar() {
  const editorMode = useStore((state) => state.editorMode);
  const commandState = useStore((state) => state.commandState);
  const syncStatus = useStore((state) => state.syncStatus);
  const trees = useStore((state) => state.trees);

  // Auto-hide "saved" indicator after 2 seconds
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSaved, setShowSaved] = React.useState(false);

  useEffect(() => {
    if (syncStatus === 'saved') {
      setShowSaved(true);
      savedTimerRef.current = setTimeout(() => {
        setShowSaved(false);
      }, 2000);
    } else {
      setShowSaved(false);
    }
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [syncStatus]);

  if (!editorMode.active) return null;

  const treeLabel =
    trees.archived.find((t) => t.id === editorMode.treeId)?.label ??
    trees.active?.label ??
    'Untitled';

  const canUndo = commandState?.canUndo ?? false;
  const canRedo = commandState?.canRedo ?? false;

  const handleUndo = () => {
    sendMessage(msg.undo());
  };

  const handleRedo = () => {
    sendMessage(msg.redo());
  };

  const handleExit = () => {
    sendMessage(msg.exitEditorMode());
  };

  const handleRetry = () => {
    sendMessage(msg.editorSyncRetry());
  };

  return (
    <div className="editor-toolbar">
      <div className="editor-toolbar__label" title={treeLabel}>
        <Icons.Pencil size={12} className="editor-toolbar__icon" />
        <span className="editor-toolbar__text">Editing: {treeLabel}</span>
      </div>

      <div className="editor-toolbar__actions">
        {/* Sync status */}
        {syncStatus === 'saving' && (
          <span className="editor-toolbar__sync editor-toolbar__sync--saving">
            <Icons.RefreshCw size={12} className="editor-toolbar__spin" />
            <span>Saving…</span>
          </span>
        )}
        {syncStatus === 'saved' && showSaved && (
          <span className="editor-toolbar__sync editor-toolbar__sync--saved">
            <Icons.Check size={12} />
            <span>Saved</span>
          </span>
        )}
        {syncStatus === 'error' && (
          <span className="editor-toolbar__sync editor-toolbar__sync--error">
            <Icons.AlertTriangle size={12} />
            <button
              type="button"
              className="editor-toolbar__retry"
              onClick={handleRetry}
              title="Retry sync"
            >
              Sync failed – retry
            </button>
          </span>
        )}

        <button
          type="button"
          className="editor-toolbar__btn"
          disabled={!canUndo}
          onClick={handleUndo}
          title={
            commandState?.nextUndoDesc
              ? `Undo: ${commandState.nextUndoDesc}`
              : 'Undo'
          }
        >
          <Icons.Undo2 size={14} />
        </button>
        <button
          type="button"
          className="editor-toolbar__btn"
          disabled={!canRedo}
          onClick={handleRedo}
          title={
            commandState?.nextRedoDesc
              ? `Redo: ${commandState.nextRedoDesc}`
              : 'Redo'
          }
        >
          <Icons.Redo2 size={14} />
        </button>

        <span className="editor-toolbar__divider" />

        <button
          type="button"
          className="editor-toolbar__exit"
          onClick={handleExit}
          title="Exit editor mode"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
