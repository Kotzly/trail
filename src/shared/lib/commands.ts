import type { Description, JSONString } from "../types/ids";
import { NavigationTreeJSON } from "../types/tree";

// max history stack size (todo: make this configurable by the user)
const MAX_HISTORY = 30;


export type Snapshot = {
    treeJSON: JSONString;
    description: Description;
}

export type CommandState = {
    canUndo: boolean;
    canRedo: boolean;
    nextUndoDesc?: Description;
    nextRedoDesc?: Description;
}

export class CommandManager {
    private static undoStack: Snapshot[] = [];
    private static redoStack: Snapshot[] = [];


    static saveSnapshot(treeJSON: NavigationTreeJSON, desc: Description): void {
        this.undoStack.push({
          treeJSON: JSON.stringify(treeJSON) as JSONString,
          description: desc,
        });
      
        this.redoStack = this.redoStack.slice(0, 0); // new action invalidates redo history
        while (this.undoStack.length > MAX_HISTORY) {
          this.undoStack.shift(); // todo: check code for correctness
        }
      }
    static undo(currentTreeJSON: NavigationTreeJSON): NavigationTreeJSON | null {
        if (this.undoStack.length === 0) return null;

        this.redoStack.push({
            treeJSON: JSON.stringify(currentTreeJSON) as JSONString,
            description: this.undoStack[this.undoStack.length - 1]?.description || 'Undo' as Description,
        });
        
        const previousState = this.undoStack.pop();
        return previousState ? JSON.parse(previousState.treeJSON) as NavigationTreeJSON : null;
    }
    static redo(currentTreeJSON: NavigationTreeJSON): NavigationTreeJSON | null {
        if (this.redoStack.length === 0) return null;
      
        this.undoStack.push({
          treeJSON: JSON.stringify(currentTreeJSON) as JSONString,
          description: this.redoStack[this.redoStack.length - 1]?.description || 'Redo' as Description,
        });
      
        // Pop and return next state
        const nextState = this.redoStack.pop();
        return nextState ? JSON.parse(nextState.treeJSON) as NavigationTreeJSON : null;
    }

    static canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    static canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    static getNextUndoDesc(): Description | undefined {
        return this.undoStack[this.undoStack.length - 1]?.description;
    }
    static getNextRedoDesc(): Description | undefined {
        return this.redoStack[this.redoStack.length - 1]?.description;
    }
    
    static getState(): CommandState {
        return {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            nextUndoDesc: this.getNextUndoDesc(),
            nextRedoDesc: this.getNextRedoDesc(),
        } as CommandState;
    }

    static clearHistory() {
        this.undoStack = this.undoStack.slice(0, 0)
        this.redoStack = this.redoStack.slice(0, 0)
    }
}
