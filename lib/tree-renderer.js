/**
 * Tree View Renderer - displays navigation history as a branching tree.
 * Forks create labeled branches for clear visual separation.
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
 * Create tree node element.
 * Uses <a> tag so browser shows URL in status bar on hover.
 * @param {object} node - Tree node data
 * @param {number} currentId - ID of current node
 * @param {Function} onNavigate - Callback for navigation (node) => void
 * @param {Set} openNodeIds - Set of node IDs that have open tabs (multi-tab mode)
 * @returns {HTMLElement}
 */
function createTreeNode(node, currentId, onNavigate, openNodeIds, nodeTabCounts = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node-wrapper';
  
  const anchor = document.createElement('a');
  anchor.className = 'tree-node';
  anchor.href = node.url;
  anchor.dataset.nodeId = node.id;
  
  if (node.id === currentId) anchor.classList.add('current');
  
  // Mark closed nodes in multi-tab mode
  if (openNodeIds && openNodeIds.size > 0 && !openNodeIds.has(node.id)) {
    anchor.classList.add('closed');
  }
  
  // Mark nodes that have multiple children (fork points)
  const hasFork = node.children && node.children.length > 1;
  if (hasFork) anchor.classList.add('fork-point');
  
  anchor.innerHTML = `
    <div class="node-content">
      <div class="node-title">${escapeHtml(node.title || 'Untitled')}</div>
      <div class="node-url">${escapeHtml(formatUrl(node.url))}</div>
    </div>
    <div class="node-time">${formatTime(node.timestamp)}</div>
  `;
  
  // Insert favicon at the beginning
  anchor.insertBefore(createFaviconElement(node.favicon), anchor.firstChild);
  
  // Tab count badge (multiple tabs for same node in same window)
  const tabCount = nodeTabCounts[node.id];
  if (tabCount && tabCount > 1) {
    const badge = document.createElement('div');
    badge.className = 'tree-node-tab-count';
    badge.textContent = `${tabCount}x`;
    badge.title = `${tabCount} tabs open for this page`;
    anchor.appendChild(badge);
  }
  
  // Add fork indicator if has multiple children
  if (hasFork) {
    const forkIndicator = document.createElement('div');
    forkIndicator.className = 'fork-indicator';
    forkIndicator.textContent = `${node.children.length} branches`;
    anchor.appendChild(forkIndicator);
  }
  
  // Click handler
  anchor.addEventListener('click', (event) => {
    event.preventDefault();
    onNavigate(node);
  });
  
  wrapper.appendChild(anchor);
  return wrapper;
}

/**
 * Create a branch header element.
 * @param {number} branchIndex - 0-based branch index
 * @returns {HTMLElement}
 */
function createBranchHeader(branchIndex) {
  const header = document.createElement('div');
  header.className = `branch-header branch-${(branchIndex % 5) + 1}`;
  header.innerHTML = `
    <span class="branch-icon">↳</span>
    <span>Branch ${branchIndex + 1}</span>
  `;
  return header;
}

/**
 * Render a branch (a node and all its descendants) into a container.
 * @param {object} node - Node to render
 * @param {HTMLElement} container - Container element
 * @param {number} branchIndex - Branch index (0-based) for styling
 * @param {number} currentId - Current node ID
 * @param {Function} onNavigate - Navigation callback
 * @param {Set} openNodeIds - Set of node IDs with open tabs
 */
function renderBranch(node, container, branchIndex, currentId, onNavigate, openNodeIds) {
  if (!node) return;
  
  // Create branch wrapper with header
  const branchWrapper = document.createElement('div');
  branchWrapper.className = 'branch-wrapper';
  
  // Add branch header
  branchWrapper.appendChild(createBranchHeader(branchIndex));
  
  // Create branch content container with colored left border
  const branchContent = document.createElement('div');
  branchContent.className = `branch-content branch-${(branchIndex % 5) + 1}`;
  
  // Render this node and all its linear descendants
  renderLinearChain(node, branchContent, currentId, onNavigate, openNodeIds);
  
  branchWrapper.appendChild(branchContent);
  container.appendChild(branchWrapper);
}

/**
 * Render a node and its linear chain of single children.
 * When a fork is encountered, render each branch separately.
 */
function renderLinearChain(node, container, currentId, onNavigate, openNodeIds) {
  if (!node) return;
  
  // Create node element
    const nodeEl = createTreeNode(node, currentId, onNavigate, openNodeIds, nodeTabCounts);
    container.appendChild(nodeEl);
  
  // Check children
  if (!node.children || node.children.length === 0) {
    return; // Leaf node
  }
  
  if (node.children.length === 1) {
    // Single child - continue linear chain
    renderLinearChain(node.children[0], container, currentId, onNavigate, openNodeIds);
  } else {
    // Fork! Create a fork container for all branches
    const forkContainer = document.createElement('div');
    forkContainer.className = 'fork-container';
    
    node.children.forEach((child, idx) => {
      renderBranch(child, forkContainer, idx, currentId, onNavigate, openNodeIds);
    });
    
    container.appendChild(forkContainer);
  }
}

/**
 * Render the root level (no branch header for root).
 */
function renderRootChain(node, container, currentId, onNavigate, openNodeIds) {
  if (!node) return;
  
  // Create node element
    const nodeEl = createTreeNode(node, currentId, onNavigate, openNodeIds, nodeTabCounts);
    container.appendChild(nodeEl);
  
  // Check children
  if (!node.children || node.children.length === 0) {
    return;
  }
  
  if (node.children.length === 1) {
    // Single child - continue
    renderRootChain(node.children[0], container, currentId, onNavigate, openNodeIds);
  } else {
    // Fork! Create branches with headers
    const forkContainer = document.createElement('div');
    forkContainer.className = 'fork-container';
    
    node.children.forEach((child, idx) => {
      renderBranch(child, forkContainer, idx, currentId, onNavigate, openNodeIds);
    });
    
    container.appendChild(forkContainer);
  }
}

/**
 * Create a root separator element between forest trees.
 * @param {number} rootIndex - 0-based root index
 * @returns {HTMLElement}
 */
function createRootSeparator(rootIndex) {
  const separator = document.createElement('div');
  separator.className = 'root-separator';
  separator.innerHTML = `
    <div class="root-separator-line"></div>
    <span class="root-separator-label">Trail ${rootIndex + 1}</span>
    <div class="root-separator-line"></div>
  `;
  return separator;
}

/**
 * Render tree view.
 * Supports multiple roots (forest structure) - each new tab starts a new tree.
 * @param {object} treeData - Serialized tree data
 * @param {HTMLElement} container - Container element
 * @param {object} options - Render options { onNavigate: Function, openNodeIds?: Set }
 * @returns {number|null} - Current node ID
 */
function renderTreeView(treeData, container, options) {
  const { onNavigate, openNodeIds, nodeTabCounts = {} } = options;
  
  // Support both 'roots' array and legacy 'root' field
  const roots = treeData?.roots || (treeData?.root ? [treeData.root] : []);
  const treeCurrentId = treeData?.currentNodeId;
  
  // Clear container
  container.innerHTML = '';
  
  if (roots.length === 0) {
    return null;
  }
  
  // Render each root tree
  roots.forEach((root, idx) => {
    // Add separator between roots (not before first one)
    if (idx > 0) {
      container.appendChild(createRootSeparator(idx));
    }
    
    // Render this root tree
    renderRootChain(root, container, treeCurrentId, onNavigate, openNodeIds);
  });
  
  return treeCurrentId;
}

// Register the renderer
registerRenderer(VIEW_MODE.TREE, renderTreeView);

export { renderTreeView };
