import { CommandState } from "../../shared/types/messages";
import { PanelState } from "../state/panel-state";
import { getCommandState, redo, undo } from "../api/commands";

// Fetch and update undo / redo state from service worker.
export async function fetchCommandState(): Promise<void> {
    try {
        const state = await getCommandState();
        updateCommandButtons(state);
    } catch (error) {
        console.error('Failed to fetch command state:', error);
    }
}


// Update undo/redo button states.
export function updateCommandButtons(state: CommandState): void {
    const undoBtn = document.getElementById('undoBtn') as HTMLButtonElement | null;
    const redoBtn = document.getElementById('redoBtn') as HTMLButtonElement | null;
    
    const undoShortcut = `${PanelState.metaKey!.short}+z (${PanelState.metaKey!.long}+z)`;
    const redoShortcut = `${PanelState.metaKey!.short}+⇧+z (${PanelState.metaKey!.long}+shift+z)`;
    
    if (undoBtn) {
      undoBtn.disabled = !state.canUndo;
      undoBtn.title = state.nextUndoDesc 
        ? `Undo: ${state.nextUndoDesc} (${undoShortcut})` 
        : `Undo (${undoShortcut})`;
    }
    
    if (redoBtn) {
      redoBtn.disabled = !state.canRedo;
      redoBtn.title = state.nextRedoDesc 
        ? `Redo: ${state.nextRedoDesc} (${redoShortcut})` 
        : `Redo (${redoShortcut})`;
    }
  }
  
  
export async function handleUndo() {
    try {
        const res = await undo()
        updateCommandButtons(res);
    } catch (error) {
        console.error('Failed to undo:', error);
    }
}

export async function handleRedo() {
    try {
        const res = await redo()
        updateCommandButtons(res);
    } catch (error) {
        console.error('Failed to redo:', error);
    }
}