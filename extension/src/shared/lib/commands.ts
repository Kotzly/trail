import { z } from "zod";
import type { Description, JSONString } from "../types/ids.js";
import type { CommandState } from "../rpc/contracts.js";
import { type NavigationTreeJSON } from "../types/tree.js";
import { undoHistoryItem } from "../config/storage-items.js";
import pDebounce from "p-debounce";

// max history stack size (todo: make this configurable by the user)
const MAX_HISTORY = 30;

export type Snapshot = {
  treeJSON: JSONString;
  description: Description;
};

const snapshotSchema = z
  .object({
    treeJSON: z.string(),
    description: z.string(),
  })
  .transform(({ treeJSON, description }) => ({
    treeJSON: treeJSON as JSONString,
    description: description as Description,
  }));

export class CommandManager {
  private static undoStack: Snapshot[] = [];
  private static redoStack: Snapshot[] = [];
  private static loaded = false;
  private static loading: Promise<void> | null = null;
  private static dirtyDuringLoad = false;

  private static sanitizeStack(raw: unknown): Snapshot[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry) => {
      const parsed = snapshotSchema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    });
  }

  private static schedulePersist = pDebounce(() => CommandManager.persistNow(), 300);

  private static async persistNow(): Promise<void> {
    try {
      await undoHistoryItem.setValue({
        undoStack: this.undoStack,
        redoStack: this.redoStack,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error("CommandManager.persistNow: Failed to persist history", error);
    }
  }

  static async init(): Promise<void> {
    if (this.loaded) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const stored = await undoHistoryItem.getValue();
        if (!this.dirtyDuringLoad && stored) {
          this.undoStack = this.sanitizeStack(stored.undoStack);
          this.redoStack = this.sanitizeStack(stored.redoStack);
        }
      } catch (error) {
        console.error("CommandManager.init: Failed to load history", error);
      } finally {
        this.loaded = true;
        this.loading = null;
        this.dirtyDuringLoad = false;
      }
    })();
    return this.loading;
  }

  static saveSnapshot(treeJSON: NavigationTreeJSON, desc: Description): void {
    if (!this.loaded && this.loading) {
      this.dirtyDuringLoad = true;
    }
    this.undoStack.push({
      treeJSON: JSON.stringify(treeJSON) as JSONString,
      description: desc,
    });

    this.redoStack = []; // new action invalidates redo history
    while (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }
    void this.schedulePersist();
  }
  static undo(currentTreeJSON: NavigationTreeJSON): NavigationTreeJSON | null {
    if (this.undoStack.length === 0) return null;
    if (!this.loaded && this.loading) {
      this.dirtyDuringLoad = true;
    }

    this.redoStack.push({
      treeJSON: JSON.stringify(currentTreeJSON) as JSONString,
      description:
        this.undoStack[this.undoStack.length - 1]?.description || ("Undo" as Description),
    });

    const previousState = this.undoStack.pop();
    void this.schedulePersist();
    return previousState ? (JSON.parse(previousState.treeJSON) as NavigationTreeJSON) : null;
  }
  static redo(currentTreeJSON: NavigationTreeJSON): NavigationTreeJSON | null {
    if (this.redoStack.length === 0) return null;
    if (!this.loaded && this.loading) {
      this.dirtyDuringLoad = true;
    }

    this.undoStack.push({
      treeJSON: JSON.stringify(currentTreeJSON) as JSONString,
      description:
        this.redoStack[this.redoStack.length - 1]?.description || ("Redo" as Description),
    });

    // Pop and return next state
    const nextState = this.redoStack.pop();
    void this.schedulePersist();
    return nextState ? (JSON.parse(nextState.treeJSON) as NavigationTreeJSON) : null;
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
    if (!this.loaded && this.loading) {
      this.dirtyDuringLoad = true;
    }
    this.undoStack = [];
    this.redoStack = [];
    void this.schedulePersist();
  }
}
