/**
 * View modes configuration for the extension.
 * Easily extensible - just add new modes to VIEW_MODES.
 */

/**
 * Available view mode identifiers.
 * @readonly
 * @enum {string}
 */
export const VIEW_MODE = {
  TREE: 'tree',
  STACK: 'stack',
  GRAPH: 'graph'
};

/**
 * Metadata for each view mode.
 * @type {Object.<string, {id: string, label: string, description: string, icon: string}>}
 */
export const VIEW_MODES = {
  [VIEW_MODE.TREE]: {
    id: VIEW_MODE.TREE,
    label: 'Tree View',
    description: 'Shows navigation history as a branching tree',
    icon: '🌳'
  },
  [VIEW_MODE.STACK]: {
    id: VIEW_MODE.STACK,
    label: 'Stack View',
    description: 'Shows navigation history as a simple LIFO stack',
    icon: '📚'
  },
  [VIEW_MODE.GRAPH]: {
    id: VIEW_MODE.GRAPH,
    label: 'Graph View',
    description: 'Interactive canvas with nodes like n8n',
    icon: '🔀'
  }
};

/**
 * Get all available view modes.
 * @returns {Array<{id: string, label: string, description: string, icon: string}>}
 */
export function getViewModes() {
  return Object.values(VIEW_MODES);
}

/**
 * Get view mode metadata by ID.
 * @param {string} modeId
 * @returns {{id: string, label: string, description: string, icon: string} | null}
 */
export function getViewMode(modeId) {
  return VIEW_MODES[modeId] || null;
}

/**
 * Check if a view mode ID is valid.
 * @param {string} modeId
 * @returns {boolean}
 */
export function isValidViewMode(modeId) {
  return modeId in VIEW_MODES;
}

/**
 * Default view mode.
 */
export const DEFAULT_VIEW_MODE = VIEW_MODE.TREE;
