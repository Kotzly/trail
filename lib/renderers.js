/**
 * Renderer registry for different view modes.
 * Each renderer handles displaying navigation data in its own style.
 * 
 * To add a new view mode:
 * 1. Add the mode to lib/view-modes.js
 * 2. Create a render function here
 * 3. Register it in RENDERERS object
 */

import { VIEW_MODE } from './view-modes.js';

/**
 * Registry of render functions.
 * Each function takes (treeData, container, options) and renders the UI.
 * @type {Object.<string, Function>}
 */
const RENDERERS = {};

/**
 * Register a renderer for a view mode.
 * @param {string} modeId - View mode identifier
 * @param {Function} renderFn - Render function (treeData, container, options) => currentNodeId
 */
export function registerRenderer(modeId, renderFn) {
  RENDERERS[modeId] = renderFn;
}

/**
 * Get renderer for a view mode.
 * @param {string} modeId - View mode identifier
 * @returns {Function|null}
 */
export function getRenderer(modeId) {
  return RENDERERS[modeId] || null;
}

/**
 * Check if a renderer exists for a view mode.
 * @param {string} modeId - View mode identifier
 * @returns {boolean}
 */
export function hasRenderer(modeId) {
  return modeId in RENDERERS;
}

/**
 * Get all registered renderer IDs.
 * @returns {string[]}
 */
export function getRegisteredRenderers() {
  return Object.keys(RENDERERS);
}

// ============================================
// Helper functions shared across renderers
// ============================================

/**
 * Format timestamp to relative time.
 * @param {number} timestamp
 * @returns {string}
 */
export function formatTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Extract display URL (hostname + path + hash).
 * @param {string} url
 * @returns {string}
 */
export function formatUrl(url) {
  try {
    const urlObj = new URL(url);
    let display = urlObj.hostname;
    if (urlObj.pathname !== '/') display += urlObj.pathname;
    if (urlObj.hash) display += urlObj.hash;
    return display;
  } catch {
    return url;
  }
}

/**
 * Escape HTML to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Create favicon element with fallback.
 * @param {string} faviconUrl
 * @returns {HTMLElement}
 */
export function createFaviconElement(faviconUrl) {
  const container = document.createElement('div');
  container.className = 'entry-icon';
  
  if (faviconUrl) {
    const img = document.createElement('img');
    img.src = faviconUrl;
    img.alt = '';
    img.onerror = () => {
      container.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v8M8 12h8"/>
        </svg>
      `;
    };
    container.appendChild(img);
  } else {
    container.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v8M8 12h8"/>
      </svg>
    `;
  }
  
  return container;
}
