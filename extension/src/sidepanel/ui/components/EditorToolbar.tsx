import React from 'react';
import { useStore } from '../state/store.js';
import { Icons } from './Icon.js';
import { sendMessage } from '../../api/background.js';
import { msg } from '../../../shared/types/messages.js';

export default function EditorToolbar() {
  const editorMode = useStore((state) => state.editorMode);
  const commandState = useStore((state) => state.commandState);
  const trees = useStore((state) => state.trees);

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

  return (
    <div className="editor-toolbar">
      <div className="editor-toolbar__label" title={treeLabel}>
        <Icons.Pencil size={12} className="editor-toolbar__icon" />
        <span className="editor-toolbar__text">Editing: {treeLabel}</span>
      </div>

      <div className="editor-toolbar__actions">
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
