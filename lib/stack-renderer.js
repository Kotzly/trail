/**
 * Stack View Renderer - displays navigation history as a simple LIFO stack.
 * Shows all pages in chronological order (newest at bottom).
 */

import { VIEW_MODE } from './view-modes.js';
import { 
  registerRenderer, 
  formatTime, 
  formatUrl, 
  escapeHtml, 
  createFaviconElement 
} from './renderers.js';

/**
 * Flatten tree to array in chronological order.
 * @param {object} node - Tree node
 * @param {Array} result - Accumulator array
 * @returns {Array}
 */
function flattenTree(node, result = []) {
  if (!node) return result;
  
  result.push(node);
  
  if (node.children && node.children.length > 0) {
    // Sort children by timestamp to maintain chronological order
    const sortedChildren = [...node.children].sort((a, b) => a.timestamp - b.timestamp);
    sortedChildren.forEach(child => flattenTree(child, result));
  }
  
  return result;
}

/**
 * Create stack entry element.
 * Uses <a> tag so browser shows URL in status bar on hover.
 * @param {object} node - Node data
 * @param {number} currentId - ID of current node
 * @param {Function} onNavigate - Callback for navigation (node) => void
 * @param {Set} openNodeIds - Set of node IDs with open tabs (multi-tab mode)
 * @returns {HTMLElement}
 */
function createStackEntry(node, currentId, onNavigate, openNodeIds) {
  const anchor = document.createElement('a');
  anchor.className = 'stack-entry';
  anchor.href = node.url;
  anchor.dataset.nodeId = node.id;
  
  if (node.id === currentId) anchor.classList.add('current');
  
  // Mark closed nodes in multi-tab mode
  if (openNodeIds && openNodeIds.size > 0 && !openNodeIds.has(node.id)) {
    anchor.classList.add('closed');
  }
  
  anchor.innerHTML = `
    <div class="entry-content">
      <div class="entry-title">${escapeHtml(node.title || 'Untitled')}</div>
      <div class="entry-url">${escapeHtml(formatUrl(node.url))}</div>
    </div>
    <div class="entry-time">${formatTime(node.timestamp)}</div>
  `;
  
  // Insert favicon at the beginning
  anchor.insertBefore(createFaviconElement(node.favicon), anchor.firstChild);
  
  // Click handler
  anchor.addEventListener('click', (event) => {
    event.preventDefault();
    onNavigate(node);
  });
  
  return anchor;
}

/**
 * Render stack view.
 * @param {object} treeData - Serialized tree data
 * @param {HTMLElement} container - Container element
 * @param {object} options - Render options { onNavigate: Function, openNodeIds?: Set }
 * @returns {number|null} - Current node ID
 */
function renderStackView(treeData, container, options) {
  const { onNavigate, openNodeIds } = options;
  
  const root = treeData?.root;
  const treeCurrentId = treeData?.currentNodeId;
  
  // Clear container
  container.innerHTML = '';
  
  if (!root) {
    return null;
  }
  
  // Flatten tree to array
  const entries = flattenTree(root);
  
  // Render each entry
  entries.forEach(node => {
    const entry = createStackEntry(node, treeCurrentId, onNavigate, openNodeIds);
    container.appendChild(entry);
  });
  
  return treeCurrentId;
}

// Register the renderer
registerRenderer(VIEW_MODE.STACK, renderStackView);

export { renderStackView };
