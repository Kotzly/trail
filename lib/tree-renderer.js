/**
 * Tree View Renderer - displays navigation history as a branching tree.
 * Forks create indented branches with visual connectors.
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
 * @returns {HTMLElement}
 */
function createTreeNode(node, currentId, onNavigate) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node-wrapper';
  
  const anchor = document.createElement('a');
  anchor.className = 'tree-node';
  anchor.href = node.url;
  anchor.dataset.nodeId = node.id;
  
  if (node.id === currentId) anchor.classList.add('current');
  
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
  
  // Add fork indicator if has multiple children
  if (hasFork) {
    const forkIndicator = document.createElement('div');
    forkIndicator.className = 'fork-indicator';
    forkIndicator.textContent = `⑂ ${node.children.length}`;
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
 * Render a branch (a node and all its descendants) into a container.
 */
function renderBranch(node, container, indent, currentId, isFirstBranch, isLastBranch, onNavigate) {
  if (!node) return;
  
  // Create branch container if this is a forked branch
  const branchContainer = document.createElement('div');
  branchContainer.className = 'branch-container';
  if (indent > 0) {
    branchContainer.style.marginLeft = `${indent * 20}px`;
    branchContainer.classList.add('indented');
    if (isFirstBranch) branchContainer.classList.add('first-branch');
    if (isLastBranch) branchContainer.classList.add('last-branch');
  }
  
  // Render this node and all its linear descendants
  renderLinearChain(node, branchContainer, currentId, onNavigate);
  
  container.appendChild(branchContainer);
}

/**
 * Render a node and its linear chain of single children.
 * When a fork is encountered, render each branch separately.
 */
function renderLinearChain(node, container, currentId, onNavigate) {
  if (!node) return;
  
  // Create node element
  const nodeEl = createTreeNode(node, currentId, onNavigate);
  container.appendChild(nodeEl);
  
  // Check children
  if (!node.children || node.children.length === 0) {
    return; // Leaf node
  }
  
  if (node.children.length === 1) {
    // Single child - continue linear chain
    renderLinearChain(node.children[0], container, currentId, onNavigate);
  } else {
    // Fork! Create a fork container for all branches
    const forkContainer = document.createElement('div');
    forkContainer.className = 'fork-container';
    
    node.children.forEach((child, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === node.children.length - 1;
      renderBranch(child, forkContainer, 1, currentId, isFirst, isLast, onNavigate);
    });
    
    container.appendChild(forkContainer);
  }
}

/**
 * Render tree view.
 * @param {object} treeData - Serialized tree data
 * @param {HTMLElement} container - Container element
 * @param {object} options - Render options { onNavigate: Function }
 * @returns {number|null} - Current node ID
 */
function renderTreeView(treeData, container, options) {
  const { onNavigate } = options;
  
  const root = treeData?.root;
  const treeCurrentId = treeData?.currentNodeId;
  
  // Clear container
  container.innerHTML = '';
  
  if (!root) {
    return null;
  }
  
  // Render tree starting from root
  renderBranch(root, container, 0, treeCurrentId, true, true, onNavigate);
  
  return treeCurrentId;
}

// Register the renderer
registerRenderer(VIEW_MODE.TREE, renderTreeView);

export { renderTreeView };
