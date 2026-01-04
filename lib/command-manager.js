/**
 * Simple Undo/Redo Manager using tree snapshots.
 * Stores complete tree states before mutations for easy restoration.
 * 
 * ARCHITECTURE NOTES:
 * - Uses immutable snapshots (JSON strings) for state storage
 * - Each mutation saves a snapshot before modification
 * - Undo/redo restore from snapshots, creating new tree instances
 * - This pattern enables future migration to full immutability
 * 
 * Used in the service worker to track tree state changes.
 */

// Maximum number of snapshots to keep
const MAX_HISTORY = 30;

// History stacks (stored as serialized tree JSON strings)
let undoStack = [];
let redoStack = [];

// Descriptions for UI display
let undoDescriptions = [];
let redoDescriptions = [];

/**
 * Save a snapshot of the tree before a mutation.
 * @param {object} treeJSON - The tree serialized to JSON (from tree.toJSON())
 * @param {string} description - Human-readable description of the action
 */
export function saveSnapshot(treeJSON, description) {
  // Add to undo stack
  undoStack.push(JSON.stringify(treeJSON));
  undoDescriptions.push(description);
  
  // Clear redo stack (new action invalidates redo history)
  redoStack = [];
  redoDescriptions = [];
  
  // Enforce max history
  while (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
    undoDescriptions.shift();
  }
}

/**
 * Undo: restore the previous tree state.
 * @param {object} currentTreeJSON - Current tree state (for redo)
 * @returns {object|null} - Previous tree state JSON to restore, or null if no undo available
 */
export function undo(currentTreeJSON) {
  if (undoStack.length === 0) return null;
  
  // Save current state to redo stack
  redoStack.push(JSON.stringify(currentTreeJSON));
  redoDescriptions.push(undoDescriptions[undoDescriptions.length - 1] || 'Undo');
  
  // Pop and return previous state
  const previousState = undoStack.pop();
  undoDescriptions.pop();
  
  return JSON.parse(previousState);
}

/**
 * Redo: restore the state before the last undo.
 * @param {object} currentTreeJSON - Current tree state (for undo)
 * @returns {object|null} - Next tree state JSON to restore, or null if no redo available
 */
export function redo(currentTreeJSON) {
  if (redoStack.length === 0) return null;
  
  // Save current state to undo stack
  undoStack.push(JSON.stringify(currentTreeJSON));
  undoDescriptions.push(redoDescriptions[redoDescriptions.length - 1] || 'Redo');
  
  // Pop and return next state
  const nextState = redoStack.pop();
  redoDescriptions.pop();
  
  return JSON.parse(nextState);
}

/**
 * Check if undo is available.
 * @returns {boolean}
 */
export function canUndo() {
  return undoStack.length > 0;
}

/**
 * Check if redo is available.
 * @returns {boolean}
 */
export function canRedo() {
  return redoStack.length > 0;
}

/**
 * Get the description of the next undo action.
 * @returns {string|null}
 */
export function getUndoDescription() {
  if (undoDescriptions.length === 0) return null;
  return undoDescriptions[undoDescriptions.length - 1];
}

/**
 * Get the description of the next redo action.
 * @returns {string|null}
 */
export function getRedoDescription() {
  if (redoDescriptions.length === 0) return null;
  return redoDescriptions[redoDescriptions.length - 1];
}

/**
 * Get undo/redo state for UI.
 * @returns {object} - { canUndo, canRedo, undoDescription, redoDescription }
 */
export function getState() {
  return {
    canUndo: canUndo(),
    canRedo: canRedo(),
    undoDescription: getUndoDescription(),
    redoDescription: getRedoDescription()
  };
}

/**
 * Clear all history.
 */
export function clearHistory() {
  undoStack = [];
  redoStack = [];
  undoDescriptions = [];
  redoDescriptions = [];
}
