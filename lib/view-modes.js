/**
 * View mode configuration for the extension.
 * Only graph view mode is supported.
 */

/**
 * Available view mode identifiers.
 * @readonly
 * @enum {string}
 */
export const VIEW_MODE = {
  GRAPH: 'graph'
};

/**
 * Metadata for graph view mode.
 * @type {Object.<string, {id: string, label: string, description: string, icon: string}>}
 */
export const VIEW_MODES = {
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
 * Default view mode (always graph).
 */
export const DEFAULT_VIEW_MODE = VIEW_MODE.GRAPH;
