/**
 * Graph View Renderer - interactive canvas with draggable nodes.
 * Features: pan, smooth zoom centered on cursor, vertical tree layout.
 */

import { VIEW_MODE } from './view-modes.js';
import { 
  registerRenderer, 
  formatTime, 
  formatUrl, 
  escapeHtml 
} from './renderers.js';

// Predefined tags with colors
export const TAG_PRESETS = [
  { id: 'important', label: 'Important', color: '#ef4444' },
  { id: 'reference', label: 'Reference', color: '#3b82f6' },
  { id: 'todo', label: 'To Do', color: '#f59e0b' },
  { id: 'dead-end', label: 'Dead End', color: '#6b7280' },
  { id: 'bookmark', label: 'Bookmark', color: '#8b5cf6' }
];

// Layout constants - VERTICAL orientation (top to bottom)
// Normal mode
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const VERTICAL_GAP = 60;   // Gap between parent and children (Y direction)
const HORIZONTAL_GAP = 24; // Gap between sibling nodes (X direction)
const ROOT_GAP = 60;       // Gap between separate trees (forest)
const PADDING = 40;

// Compact mode - smaller nodes with tighter spacing
const COMPACT_NODE_WIDTH = 100;
const COMPACT_NODE_HEIGHT = 40;
const COMPACT_VERTICAL_GAP = 40;
const COMPACT_HORIZONTAL_GAP = 12;
const COMPACT_ROOT_GAP = 40;

// Current layout config (set by render based on compactGraph setting)
let layoutConfig = {
  nodeWidth: NODE_WIDTH,
  nodeHeight: NODE_HEIGHT,
  verticalGap: VERTICAL_GAP,
  horizontalGap: HORIZONTAL_GAP,
  rootGap: ROOT_GAP,
  compact: false
};

// Active context menu (for cleanup)
let activeContextMenu = null;

// Current tool: 'hand' (pan) or 'select' (selection box)
let currentTool = 'hand';

// Selected nodes (for multi-select)
let selectedNodeIds = new Set();

/**
 * Remove active context menu if exists.
 */
function removeContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }
}

/**
 * Create and show context menu for a node.
 */
function showContextMenu(e, node) {
  e.preventDefault();
  removeContextMenu();
  
  const menu = document.createElement('div');
  menu.className = 'graph-context-menu';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  
  // Get tab state for this node
  const tabState = currentTabStates[node.id];
  const hasOpenTab = tabState !== undefined;
  
  // Open in this tab
  const openHere = document.createElement('div');
  openHere.className = 'graph-context-menu-item';
  openHere.textContent = 'Open in this tab';
  openHere.addEventListener('click', () => {
    if (currentOnNavigate) {
      currentOnNavigate(node);
    }
    removeContextMenu();
  });
  menu.appendChild(openHere);
  
  // Open in new tab
  const openNew = document.createElement('div');
  openNew.className = 'graph-context-menu-item';
  openNew.textContent = 'Open in new tab';
  openNew.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_IN_NEW_TAB', nodeId: node.id });
    removeContextMenu();
  });
  menu.appendChild(openNew);
  
  // Tab actions (only if tab is open)
  if (hasOpenTab) {
    // Divider before tab actions
    const tabDivider = document.createElement('div');
    tabDivider.className = 'graph-context-menu-divider';
    menu.appendChild(tabDivider);
    
    // Mute/Unmute tab
    const muteItem = document.createElement('div');
    muteItem.className = 'graph-context-menu-item';
    muteItem.innerHTML = tabState.muted 
      ? '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg> Unmute tab'
      : '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Mute tab';
    muteItem.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'TOGGLE_MUTE', nodeId: node.id });
      removeContextMenu();
    });
    menu.appendChild(muteItem);
    
    // Close tab
    const closeItem = document.createElement('div');
    closeItem.className = 'graph-context-menu-item';
    closeItem.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close tab';
    closeItem.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'CLOSE_TAB', nodeId: node.id });
      removeContextMenu();
    });
    menu.appendChild(closeItem);
  }
  
  // Divider
  const divider = document.createElement('div');
  divider.className = 'graph-context-menu-divider';
  menu.appendChild(divider);
  
  // Pin/Unpin
  const pinItem = document.createElement('div');
  pinItem.className = 'graph-context-menu-item';
  pinItem.innerHTML = node.pinned 
    ? '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg> Unpin'
    : '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg> Pin';
  pinItem.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TOGGLE_PIN', nodeId: node.id });
    removeContextMenu();
  });
  menu.appendChild(pinItem);
  
  // Tags submenu
  const tagsItem = document.createElement('div');
  tagsItem.className = 'graph-context-menu-item has-submenu';
  tagsItem.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> Tags <span class="submenu-arrow">›</span>';
  
  const tagsSubmenu = document.createElement('div');
  tagsSubmenu.className = 'graph-context-submenu';
  
  TAG_PRESETS.forEach(tag => {
    const tagOption = document.createElement('div');
    tagOption.className = 'graph-context-menu-item tag-option';
    const hasTag = node.tags && node.tags.includes(tag.id);
    tagOption.innerHTML = `
      <span class="tag-dot" style="background:${tag.color}"></span>
      <span class="tag-label">${tag.label}</span>
      ${hasTag ? '<span class="tag-check">✓</span>' : ''}
    `;
    tagOption.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hasTag) {
        chrome.runtime.sendMessage({ type: 'REMOVE_TAG', nodeId: node.id, tagId: tag.id });
      } else {
        chrome.runtime.sendMessage({ type: 'ADD_TAG', nodeId: node.id, tagId: tag.id });
      }
      removeContextMenu();
    });
    tagsSubmenu.appendChild(tagOption);
  });
  
  tagsItem.appendChild(tagsSubmenu);
  menu.appendChild(tagsItem);
  
  // Copy URL
  const copyUrl = document.createElement('div');
  copyUrl.className = 'graph-context-menu-item';
  copyUrl.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy URL';
  copyUrl.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(node.url);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
    removeContextMenu();
  });
  menu.appendChild(copyUrl);
  
  // Delete options (not shown for root nodes)
  if (!node.isRoot) {
    // Divider before delete actions
    const deleteDivider = document.createElement('div');
    deleteDivider.className = 'graph-context-menu-divider';
    menu.appendChild(deleteDivider);
    
    // Delete node (reconnect children to parent)
    const deleteNode = document.createElement('div');
    deleteNode.className = 'graph-context-menu-item danger';
    deleteNode.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Delete node';
    deleteNode.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'DELETE_NODE', nodeId: node.id });
      removeContextMenu();
    });
    menu.appendChild(deleteNode);
    
    // Delete children (only if node has children)
    if (node.children && node.children.length > 0) {
      const deleteChildren = document.createElement('div');
      deleteChildren.className = 'graph-context-menu-item danger';
      deleteChildren.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Delete children';
      deleteChildren.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'DELETE_CHILDREN', nodeId: node.id });
        removeContextMenu();
      });
      menu.appendChild(deleteChildren);
    
      // Delete this node with children
      const deleteWithChildren = document.createElement('div');
      deleteWithChildren.className = 'graph-context-menu-item danger';
      deleteWithChildren.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Delete with children';
      deleteWithChildren.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'DELETE_WITH_CHILDREN', nodeId: node.id });
        removeContextMenu();
      });
      menu.appendChild(deleteWithChildren);
    }
  } else if (node.children && node.children.length > 0) {
    // For root nodes, only show "Delete children" option
    const deleteDivider = document.createElement('div');
    deleteDivider.className = 'graph-context-menu-divider';
    menu.appendChild(deleteDivider);
    
    const deleteChildren = document.createElement('div');
    deleteChildren.className = 'graph-context-menu-item danger';
    deleteChildren.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Delete children';
    deleteChildren.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'DELETE_CHILDREN', nodeId: node.id });
      removeContextMenu();
    });
    menu.appendChild(deleteChildren);
  }
  
  document.body.appendChild(menu);
  activeContextMenu = menu;
  
  // Adjust position if menu goes off-screen
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - menuRect.height - 8}px`;
  }
  
  // Close on click outside
  const closeHandler = (ev) => {
    if (!menu.contains(ev.target)) {
      removeContextMenu();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

/**
 * Show bulk context menu for multiple selected nodes.
 */
function showBulkContextMenu(e, nodeIds) {
  e.preventDefault();
  removeContextMenu();
  
  // Copy the nodeIds at menu open time (the Set could be mutated later)
  const nodeIdsCopy = Array.from(nodeIds);
  
  const menu = document.createElement('div');
  menu.className = 'graph-context-menu';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  
  // Header showing count
  const header = document.createElement('div');
  header.className = 'graph-context-menu-header';
  header.textContent = `${nodeIdsCopy.length} nodes selected`;
  menu.appendChild(header);
  
  // Divider
  const divider1 = document.createElement('div');
  divider1.className = 'graph-context-menu-divider';
  menu.appendChild(divider1);
  
  // Pin selected
  const pinSelected = document.createElement('div');
  pinSelected.className = 'graph-context-menu-item';
  pinSelected.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg> Pin selected';
  pinSelected.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'BULK_PIN', nodeIds: nodeIdsCopy });
    selectedNodeIds.clear();
    removeContextMenu();
  });
  menu.appendChild(pinSelected);
  
  // Unpin selected
  const unpinSelected = document.createElement('div');
  unpinSelected.className = 'graph-context-menu-item';
  unpinSelected.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg> Unpin selected';
  unpinSelected.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'BULK_UNPIN', nodeIds: nodeIdsCopy });
    selectedNodeIds.clear();
    removeContextMenu();
  });
  menu.appendChild(unpinSelected);
  
  // Close selected tabs
  const closeTabs = document.createElement('div');
  closeTabs.className = 'graph-context-menu-item';
  closeTabs.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close selected tabs';
  closeTabs.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'BULK_CLOSE_TABS', nodeIds: nodeIdsCopy });
    selectedNodeIds.clear();
    removeContextMenu();
  });
  menu.appendChild(closeTabs);
  
  // Divider
  const divider2 = document.createElement('div');
  divider2.className = 'graph-context-menu-divider';
  menu.appendChild(divider2);
  
  // Delete selected (removes from tree, reconnects children)
  const deleteSelected = document.createElement('div');
  deleteSelected.className = 'graph-context-menu-item danger';
  deleteSelected.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Delete selected';
  deleteSelected.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'BULK_DELETE', nodeIds: nodeIdsCopy });
    selectedNodeIds.clear();
    removeContextMenu();
  });
  menu.appendChild(deleteSelected);
  
  document.body.appendChild(menu);
  activeContextMenu = menu;
  
  // Adjust position
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - menuRect.height - 8}px`;
  }
  
  // Close on click outside
  const closeHandler = (ev) => {
    if (!menu.contains(ev.target)) {
      removeContextMenu();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

// Graph API for external control (centering, etc.)
let graphAPI = null;

// Preserve view state across re-renders
let savedViewState = null;

/**
 * Calculate positions for all nodes in a single tree.
 * Vertical layout: root at top, children below, spreading horizontally.
 * Uses proper subtree width calculation to avoid overlapping.
 * @param {object} root - Root node
 * @param {number} startX - Starting X position for this tree
 * @returns {{ positions: Map<number, {x: number, y: number, node: object}>, width: number }}
 */
function calculateTreeLayout(root, startX = PADDING) {
  const positions = new Map();
  const subtreeWidths = new Map();
  const { nodeWidth, nodeHeight, verticalGap, horizontalGap } = layoutConfig;
  
  // First pass: calculate subtree widths (bottom-up)
  function calcWidths(node) {
    if (!node) return 0;
    if (!node.children || node.children.length === 0) {
      subtreeWidths.set(node.id, nodeWidth);
      return nodeWidth;
    }
    
    let totalWidth = 0;
    node.children.forEach((child, idx) => {
      totalWidth += calcWidths(child);
      if (idx < node.children.length - 1) {
        totalWidth += horizontalGap;
      }
    });
    
    const width = Math.max(nodeWidth, totalWidth);
    subtreeWidths.set(node.id, width);
    return width;
  }
  
  const treeWidth = calcWidths(root);
  
  // Second pass: assign positions (top-down)
  function layoutNode(node, x, y) {
    if (!node) return;
    
    const subtreeWidth = subtreeWidths.get(node.id) || nodeWidth;
    
    // Center this node within its subtree width
    const nodeX = x + (subtreeWidth - nodeWidth) / 2;
    positions.set(node.id, { x: nodeX, y, node });
    
    if (!node.children || node.children.length === 0) {
      return;
    }
    
    // Position children below
    const childY = y + nodeHeight + verticalGap;
    let childX = x;
    
    node.children.forEach((child) => {
      const childWidth = subtreeWidths.get(child.id) || nodeWidth;
      layoutNode(child, childX, childY);
      childX += childWidth + horizontalGap;
    });
  }
  
  layoutNode(root, startX, PADDING);
  
  return { positions, width: treeWidth };
}

/**
 * Calculate positions for a forest (multiple root trees).
 * Trees are arranged horizontally, left to right.
 * @param {Array} roots - Array of root nodes
 * @returns {Map<number, {x: number, y: number, node: object}>}
 */
function calculateForestLayout(roots) {
  const allPositions = new Map();
  let currentX = PADDING;
  
  roots.forEach((root) => {
    const { positions, width } = calculateTreeLayout(root, currentX);
    
    // Merge positions into allPositions
    positions.forEach((pos, id) => {
      allPositions.set(id, pos);
    });
    
    // Move X for next tree
    currentX += width + layoutConfig.rootGap;
  });
  
  return allPositions;
}

/**
 * Calculate positions for all nodes in the tree (legacy single-root).
 * @param {object} root - Root node
 * @returns {Map<number, {x: number, y: number, node: object}>}
 */
function calculateLayout(root) {
  const { positions } = calculateTreeLayout(root, PADDING);
  return positions;
}

/**
 * Get canvas bounds from positions.
 */
function getCanvasBounds(positions) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const { nodeWidth, nodeHeight } = layoutConfig;
  
  positions.forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + nodeHeight);
  });
  
  return { 
    minX, minY, maxX, maxY, 
    width: maxX + PADDING, 
    height: maxY + PADDING 
  };
}

/**
 * Create the graph canvas container with zoom controls.
 */
function createGraphCanvas() {
  const wrapper = document.createElement('div');
  wrapper.className = 'graph-wrapper';
  wrapper.tabIndex = 0; // Make focusable for keyboard events
  wrapper.style.touchAction = 'none'; // Prevent browser gesture handling
  
  const canvas = document.createElement('div');
  canvas.className = 'graph-canvas';
  canvas.style.touchAction = 'none';
  
  const connectionsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  connectionsLayer.classList.add('graph-connections');
  
  const nodesLayer = document.createElement('div');
  nodesLayer.className = 'graph-nodes';
  
  // Zoom controls
  const zoomControls = document.createElement('div');
  zoomControls.className = 'graph-zoom-controls';
  zoomControls.innerHTML = `
    <div class="graph-tool-group">
      <button class="graph-tool-btn active" data-tool="hand" title="Hand tool (H) - Pan">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
          <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
          <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
        </svg>
      </button>
      <button class="graph-tool-btn" data-tool="select" title="Select tool (V) - Select nodes">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
          <path d="M13 13l6 6"/>
        </svg>
      </button>
    </div>
    <div class="graph-zoom-divider"></div>
    <button class="graph-zoom-btn" data-zoom="in" title="Zoom in (+)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
      </svg>
    </button>
    <button class="graph-zoom-btn" data-zoom="out" title="Zoom out (-)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/>
      </svg>
    </button>
    <button class="graph-zoom-btn" data-zoom="reset" title="Reset zoom (0)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
    </button>
  `;
  
  canvas.appendChild(connectionsLayer);
  canvas.appendChild(nodesLayer);
  wrapper.appendChild(canvas);
  wrapper.appendChild(zoomControls);
  
  return { wrapper, canvas, connectionsLayer, nodesLayer, zoomControls };
}

// Store tabStates and onNavigate for use in node creation and context menu
let currentTabStates = {};
let currentOnNavigate = null;

/**
 * Create a graph node element.
 * @param {object} options - { node, position, currentId, onNavigate, openNodeIds, tabStates }
 */
function createGraphNode(node, position, currentId, onNavigate, openNodeIds = null) {
  const nodeEl = document.createElement('div');
  nodeEl.className = 'graph-node';
  nodeEl.dataset.nodeId = node.id;
  nodeEl.style.left = `${position.x}px`;
  nodeEl.style.top = `${position.y}px`;
  nodeEl.style.width = `${layoutConfig.nodeWidth}px`;
  nodeEl.style.height = `${layoutConfig.nodeHeight}px`;
  
  if (layoutConfig.compact) {
    nodeEl.classList.add('compact');
  }
  
  if (node.id === currentId) {
    nodeEl.classList.add('current');
  }
  
  // Mark as closed if in multi-tab mode and not open
  if (openNodeIds !== null && !openNodeIds.has(node.id)) {
    nodeEl.classList.add('closed');
  }
  
  // Get tab state for this node
  const tabState = currentTabStates[node.id];
  if (tabState?.muted) {
    nodeEl.classList.add('muted');
  }
  
  // Pinned indicator - minimalistic dot
  if (node.pinned) {
    nodeEl.classList.add('pinned');
    const pinIcon = document.createElement('div');
    pinIcon.className = 'graph-node-pin';
    pinIcon.title = 'Pinned';
    nodeEl.appendChild(pinIcon);
  }
  
  // Favicon
  const favicon = document.createElement('div');
  favicon.className = 'graph-node-favicon';
  if (node.favicon) {
    const img = document.createElement('img');
    img.src = node.favicon;
    img.alt = '';
    img.onerror = () => { favicon.innerHTML = '🌐'; };
    favicon.appendChild(img);
  } else {
    favicon.innerHTML = '🌐';
  }
  
  nodeEl.appendChild(favicon);
  
  // Content - compact mode shows title, normal shows title + url
  if (layoutConfig.compact) {
    const title = document.createElement('div');
    title.className = 'graph-node-title-compact';
    title.textContent = node.title || 'Untitled';
    title.title = node.url; // Show URL on hover
    nodeEl.appendChild(title);
  } else {
    const content = document.createElement('div');
    content.className = 'graph-node-content';
    content.innerHTML = `
      <div class="graph-node-title">${escapeHtml(node.title || 'Untitled')}</div>
      <div class="graph-node-url">${escapeHtml(formatUrl(node.url))}</div>
    `;
    nodeEl.appendChild(content);
  }
  
  // Tag dots
  if (node.tags && node.tags.length > 0) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'graph-node-tags';
    node.tags.forEach(tagId => {
      const tagPreset = TAG_PRESETS.find(t => t.id === tagId);
      if (tagPreset) {
        const dot = document.createElement('span');
        dot.className = 'graph-node-tag-dot';
        dot.style.backgroundColor = tagPreset.color;
        dot.title = tagPreset.label;
        tagsContainer.appendChild(dot);
      }
    });
    nodeEl.appendChild(tagsContainer);
  }
  
  // Audio indicator for tabs playing sound
  if (tabState?.audible) {
    const audioIcon = document.createElement('div');
    audioIcon.className = 'graph-node-audio';
    audioIcon.title = tabState.muted ? 'Unmute tab' : 'Mute tab';
    audioIcon.innerHTML = tabState.muted 
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
    audioIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: 'TOGGLE_MUTE', nodeId: node.id });
    });
    nodeEl.appendChild(audioIcon);
  }
  
  // Click to navigate or select
  nodeEl.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Shift+click to add/remove from selection
    if (e.shiftKey) {
      if (selectedNodeIds.has(node.id)) {
        selectedNodeIds.delete(node.id);
        nodeEl.classList.remove('selected');
      } else {
        selectedNodeIds.add(node.id);
        nodeEl.classList.add('selected');
      }
      return;
    }
    
    // Regular click: clear selection and navigate
    selectedNodeIds.clear();
    document.querySelectorAll('.graph-node.selected').forEach(el => {
      el.classList.remove('selected');
    });
    
    // Center on this node with smooth animation
    if (graphAPI && graphAPI.centerOnNode) {
      graphAPI.centerOnNode(node.id, true);
    }
    
    onNavigate(node);
  });
  
  // Right-click context menu
  nodeEl.addEventListener('contextmenu', (e) => {
    e.stopPropagation();
    showContextMenu(e, node);
  });
  
  return nodeEl;
}

/**
 * Draw connection line between parent and child (vertical layout).
 * Connection goes from bottom of parent to top of child.
 */
function createConnection(parentPos, childPos, branchIndex = 0) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.classList.add('graph-connection');
  path.classList.add(`branch-${(branchIndex % 5) + 1}`);
  const { nodeWidth, nodeHeight } = layoutConfig;
  
  // Start from bottom center of parent
  const startX = parentPos.x + nodeWidth / 2;
  const startY = parentPos.y + nodeHeight;
  
  // End at top center of child
  const endX = childPos.x + nodeWidth / 2;
  const endY = childPos.y;
  
  // Bezier curve for smooth vertical connection
  const midY = (startY + endY) / 2;
  const d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
  
  path.setAttribute('d', d);
  
  return path;
}

/**
 * Draw all connections recursively.
 * @param {object} node - Current node
 * @param {Map} positions - Node positions
 * @param {SVGElement} svg - SVG container
 * @param {Set} pathNodeIds - IDs of nodes on the path to current (for highlighting)
 */
function drawConnections(node, positions, svg, pathNodeIds = null) {
  if (!node || !node.children) return;
  
  const parentPos = positions.get(node.id);
  if (!parentPos) return;
  
  node.children.forEach((child, idx) => {
    const childPos = positions.get(child.id);
    if (childPos) {
      const connection = createConnection(parentPos, childPos, idx);
      
      // Highlight if both parent and child are on the path
      if (pathNodeIds && pathNodeIds.has(node.id) && pathNodeIds.has(child.id)) {
        connection.classList.add('on-path');
      }
      
      svg.appendChild(connection);
      drawConnections(child, positions, svg, pathNodeIds);
    }
  });
}

/**
 * Get path from root to a specific node within a given root.
 * @param {object} root - Root node
 * @param {number} targetId - Target node ID
 * @returns {Set<number>} - Set of node IDs on the path
 */
function getPathToNode(root, targetId) {
  const path = new Set();
  
  function findPath(node) {
    if (!node) return false;
    
    path.add(node.id);
    
    if (node.id === targetId) return true;
    
    if (node.children) {
      for (const child of node.children) {
        if (findPath(child)) return true;
      }
    }
    
    path.delete(node.id);
    return false;
  }
  
  findPath(root);
  return path;
}

/**
 * Get path to a target node across all roots in a forest.
 * @param {Array} roots - Array of root nodes
 * @param {number} targetId - Target node ID
 * @returns {Set<number>} - Set of node IDs on the path
 */
function getPathToNodeInForest(roots, targetId) {
  for (const root of roots) {
    const path = getPathToNode(root, targetId);
    if (path.size > 0) return path;
  }
  return new Set();
}

/**
 * Setup pan and zoom for the canvas.
 * Smooth zoom centered on cursor.
 */
function setupPanZoom(wrapper, canvas, bounds, initialTranslate, zoomControls, currentNodeId) {
  let isPanning = false;
  let startX = 0, startY = 0;

  // Restore saved state or use initial position
  const hasState = savedViewState !== null;
  let translateX = hasState ? savedViewState.translateX : initialTranslate.x;
  let translateY = hasState ? savedViewState.translateY : initialTranslate.y;
  let scale = hasState ? savedViewState.scale : 1;

  // Set canvas size
  canvas.style.width = `${bounds.width}px`;
  canvas.style.height = `${bounds.height}px`;
  canvas.style.transition = 'none'; // No CSS transitions by default

  function updateTransform(animate = false) {
    if (animate) {
      canvas.style.transition = 'transform 0.3s ease-out';
      // Remove transition after animation completes
      setTimeout(() => {
        canvas.style.transition = 'none';
      }, 300);
    } else {
      canvas.style.transition = 'none';
    }
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    savedViewState = { translateX, translateY, scale };
  }
  
  // Fit entire tree in view
  function fitToView() {
    const rect = wrapper.getBoundingClientRect();
    const treeWidth = bounds.maxX - bounds.minX + PADDING * 2;
    const treeHeight = bounds.maxY - bounds.minY + PADDING * 2;

    // Calculate scale to fit entire tree with some margin (90% of viewport)
    const scaleX = (rect.width * 0.9) / treeWidth;
    const scaleY = (rect.height * 0.9) / treeHeight;
    scale = Math.min(scaleX, scaleY, 2); // Allow up to 2x zoom for small trees

    // Center the tree
    translateX = (rect.width - treeWidth * scale) / 2 - (bounds.minX - PADDING) * scale;
    translateY = (rect.height - treeHeight * scale) / 2 - (bounds.minY - PADDING) * scale;

    updateTransform();
  }

  // Zoom function
  function zoom(direction) {
    const rect = wrapper.getBoundingClientRect();
    const pointerX = rect.width / 2;
    const pointerY = rect.height / 2;

    if (direction === 'reset') {
      fitToView();
      return;
    }

    const scaleFactor = direction === 'in' ? 1.25 : 0.8;
    const newScale = Math.min(3, Math.max(0.15, scale * scaleFactor));

    if (newScale !== scale) {
      const canvasX = (pointerX - translateX) / scale;
      const canvasY = (pointerY - translateY) / scale;

      scale = newScale;
      translateX = pointerX - canvasX * scale;
      translateY = pointerY - canvasY * scale;

      updateTransform();
    }
  }
  
  // Zoom at coordinates
  function zoomAt(pointerX, pointerY, scaleFactor) {
    const newScale = Math.min(3, Math.max(0.15, scale * scaleFactor));
    
    if (newScale !== scale) {
      const canvasX = (pointerX - translateX) / scale;
      const canvasY = (pointerY - translateY) / scale;
      
      scale = newScale;
      translateX = pointerX - canvasX * scale;
      translateY = pointerY - canvasY * scale;
      
      updateTransform();
    }
  }
  
  // ========== SELECTION STATE ==========
  let isSelecting = false;
  let selectionStartX = 0;
  let selectionStartY = 0;
  let selectionBox = null;
  
  function createSelectionBox(x, y) {
    selectionBox = document.createElement('div');
    selectionBox.className = 'graph-selection-box';
    selectionBox.style.left = `${x}px`;
    selectionBox.style.top = `${y}px`;
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    wrapper.appendChild(selectionBox);
  }
  
  function updateSelectionBox(x, y) {
    if (!selectionBox) return;
    
    const left = Math.min(selectionStartX, x);
    const top = Math.min(selectionStartY, y);
    const width = Math.abs(x - selectionStartX);
    const height = Math.abs(y - selectionStartY);
    
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
  }
  
  function finalizeSelection(mouseEvent) {
    if (!selectionBox) return;
    
    const boxRect = selectionBox.getBoundingClientRect();
    const nodes = wrapper.querySelectorAll('.graph-node');
    
    // Clear previous selection if not holding shift
    if (!mouseEvent?.shiftKey) {
      selectedNodeIds.clear();
      clearSelectionHighlights();
    }
    
    // Find nodes within selection box
    nodes.forEach(nodeEl => {
      const nodeRect = nodeEl.getBoundingClientRect();
      
      // Check if node intersects with selection box
      const intersects = !(
        nodeRect.right < boxRect.left ||
        nodeRect.left > boxRect.right ||
        nodeRect.bottom < boxRect.top ||
        nodeRect.top > boxRect.bottom
      );
      
      if (intersects) {
        const nodeId = parseInt(nodeEl.dataset.nodeId, 10);
        selectedNodeIds.add(nodeId);
        nodeEl.classList.add('selected');
      }
    });
    
    removeSelectionBox();
    
    // Show menu immediately if setting is enabled and nodes were selected
    if (selectionMenuInstantSetting && selectedNodeIds.size > 0 && mouseEvent) {
      showBulkContextMenu(mouseEvent, selectedNodeIds);
    }
  }

  // ========== MOUSE PAN / SELECT ==========
  wrapper.addEventListener('mousedown', (e) => {
    if (e.target === wrapper || e.target === canvas ||
        e.target.tagName === 'svg' || e.target.tagName === 'path') {
      
      if (currentTool === 'hand') {
        // Hand tool: panning
        isPanning = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        wrapper.style.cursor = 'grabbing';
      } else if (currentTool === 'select') {
        // Select tool: start selection box
        isSelecting = true;
        const rect = wrapper.getBoundingClientRect();
        selectionStartX = e.clientX - rect.left;
        selectionStartY = e.clientY - rect.top;
        createSelectionBox(selectionStartX, selectionStartY);
      }
      e.preventDefault();
    }
  });

  wrapper.addEventListener('mousemove', (e) => {
    if (isPanning) {
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      updateTransform();
    } else if (isSelecting) {
      const rect = wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      updateSelectionBox(x, y);
    }
  });

  wrapper.addEventListener('mouseup', (e) => {
    if (isPanning) {
      isPanning = false;
    } else if (isSelecting) {
      finalizeSelection(e);
      isSelecting = false;
    }
    updateCursor();
  });

  wrapper.addEventListener('mouseleave', (e) => {
    if (isPanning) {
      isPanning = false;
    } else if (isSelecting) {
      finalizeSelection(e);
      isSelecting = false;
    }
    updateCursor();
  });

  // ========== UNIFIED WHEEL HANDLER ==========
  // Handles: trackpad pinch (ctrlKey), modifier+scroll zoom, two-finger pan
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();

    const rect = wrapper.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    // Zoom when:
    // - ctrlKey is set (trackpad pinch on Mac sends this)
    // - Alt/Option + scroll (explicit zoom gesture)
    // - Cmd/Meta + scroll (explicit zoom gesture)
    // - Mouse wheel with deltaMode 1 or 2 (line/page mode - physical scroll wheel)
    const isTrackpadPinch = e.ctrlKey;
    const hasModifier = e.altKey || e.metaKey;
    const isMouseWheel = e.deltaMode === 1 || e.deltaMode === 2;
    const shouldZoom = isTrackpadPinch || hasModifier || isMouseWheel;

    if (shouldZoom) {
      // ZOOM - centered on pointer
      let scaleFactor;

      if (isMouseWheel) {
        // Mouse wheel: larger discrete steps
        scaleFactor = e.deltaY > 0 ? 0.85 : 1.18;
      } else {
        // Trackpad pinch or modifier+scroll: smooth continuous zoom
        // Use smaller factor for smoother feel
        scaleFactor = 1 - e.deltaY * 0.005;
      }

      zoomAt(pointerX, pointerY, scaleFactor);
    } else {
      // PAN - two-finger trackpad scroll
      translateX -= e.deltaX;
      translateY -= e.deltaY;
      updateTransform();
    }
  }, { passive: false });

  // ========== TOUCH SUPPORT (Mobile) ==========
  let lastTouchDistance = 0;

  wrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isPanning = true;
      startX = e.touches[0].clientX - translateX;
      startY = e.touches[0].clientY - translateY;
    } else if (e.touches.length === 2) {
      isPanning = false;
      lastTouchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  wrapper.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isPanning) {
      translateX = e.touches[0].clientX - startX;
      translateY = e.touches[0].clientY - startY;
      updateTransform();
    } else if (e.touches.length === 2 && lastTouchDistance > 0) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };

      const rect = wrapper.getBoundingClientRect();
      const touchX = center.x - rect.left;
      const touchY = center.y - rect.top;

      const scaleDelta = distance / lastTouchDistance;
      zoomAt(touchX, touchY, scaleDelta);

      lastTouchDistance = distance;
    }
  }, { passive: false });

  wrapper.addEventListener('touchend', () => {
    isPanning = false;
    lastTouchDistance = 0;
  });

  // Update cursor based on tool
  function updateCursor() {
    if (currentTool === 'hand') {
      wrapper.style.cursor = isPanning ? 'grabbing' : 'grab';
    } else {
      wrapper.style.cursor = 'crosshair';
    }
  }
  updateCursor();

  // ========== TOOL SWITCHING ==========
  function setTool(tool) {
    currentTool = tool;
    selectedNodeIds.clear();
    clearSelectionHighlights();
    removeSelectionBox();
    
    // Update button states
    zoomControls.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    
    updateCursor();
  }
  
  function clearSelectionHighlights() {
    wrapper.querySelectorAll('.graph-node.selected').forEach(el => {
      el.classList.remove('selected');
    });
  }
  
  function removeSelectionBox() {
    const existing = wrapper.querySelector('.graph-selection-box');
    if (existing) existing.remove();
  }

  // ========== ZOOM CONTROLS ==========
  zoomControls.addEventListener('click', (e) => {
    const zoomBtn = e.target.closest('[data-zoom]');
    if (zoomBtn) {
      zoom(zoomBtn.dataset.zoom);
      return;
    }
    
    const toolBtn = e.target.closest('[data-tool]');
    if (toolBtn) {
      setTool(toolBtn.dataset.tool);
    }
  });

  // Keyboard shortcuts
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoom('in');
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoom('out');
    } else if (e.key === '0') {
      e.preventDefault();
      zoom('reset');
    } else if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      setTool('hand');
    } else if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      setTool('select');
    } else if (e.key === 'Escape') {
      // Clear selection on Escape
      selectedNodeIds.clear();
      clearSelectionHighlights();
      removeSelectionBox();
    }
  });

  // Center view on a specific node (preserves current scale)
  function centerOnNode(nodeId, animate = true) {
    const nodeEl = wrapper.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeEl) return;

    const rect = wrapper.getBoundingClientRect();
    const nodeRect = nodeEl.getBoundingClientRect();

    // Calculate node center in canvas coordinates
    const nodeCenterX = (nodeRect.left + nodeRect.width / 2 - rect.left - translateX) / scale;
    const nodeCenterY = (nodeRect.top + nodeRect.height / 2 - rect.top - translateY) / scale;

    // Pan to center node in viewport (keep scale unchanged)
    translateX = rect.width / 2 - nodeCenterX * scale;
    translateY = rect.height / 2 - nodeCenterY * scale;

    updateTransform(animate);
  }

  // Expose API for external control
  graphAPI = { centerOnNode, fitToView, wrapper };

  // On first render: fit to view. On re-render: keep current view (no animation)
  if (!hasState) {
    fitToView();
  }
  // Apply initial transform
  updateTransform();
  
  // ========== BULK CONTEXT MENU ==========
  // Right-click on canvas shows bulk menu if nodes are selected
  wrapper.addEventListener('contextmenu', (e) => {
    // If clicking on a node, the node's own contextmenu handler takes over
    // This handles right-click on empty canvas space
    if (e.target === wrapper || e.target === canvas ||
        e.target.tagName === 'svg' || e.target.tagName === 'path') {
      
      if (selectedNodeIds.size > 0) {
        showBulkContextMenu(e, selectedNodeIds);
      }
    }
  });

  // Focus wrapper for keyboard events
  wrapper.focus();
}

/**
 * Render graph view.
/**
 * Render graph view.
 * Supports multiple roots (forest structure) - trees are arranged horizontally.
 * @param {object} treeData - Serialized tree data
 * @param {HTMLElement} container - Container element
 * @param {object} options - Render options { onNavigate, openNodeIds, compactGraph }
 * @returns {number|null} - Current node ID
 */
// Store selection menu setting for use in setupPanZoom
let selectionMenuInstantSetting = false;

function renderGraphView(treeData, container, options) {
  const { onNavigate, openNodeIds = null, compactGraph = false, tabStates = {}, selectionMenuInstant = false } = options;
  
  // Store settings for use in other functions
  selectionMenuInstantSetting = selectionMenuInstant;
  currentOnNavigate = onNavigate;
  
  // Store tab states for node creation
  currentTabStates = tabStates;
  
  // Set layout config based on compact mode
  if (compactGraph) {
    layoutConfig = {
      nodeWidth: COMPACT_NODE_WIDTH,
      nodeHeight: COMPACT_NODE_HEIGHT,
      verticalGap: COMPACT_VERTICAL_GAP,
      horizontalGap: COMPACT_HORIZONTAL_GAP,
      rootGap: COMPACT_ROOT_GAP,
      compact: true
    };
  } else {
    layoutConfig = {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      verticalGap: VERTICAL_GAP,
      horizontalGap: HORIZONTAL_GAP,
      rootGap: ROOT_GAP,
      compact: false
    };
  }
  
  // Support both 'roots' array and legacy 'root' field
  const roots = treeData?.roots || (treeData?.root ? [treeData.root] : []);
  const currentId = treeData?.currentNodeId;
  
  // Clear container
  container.innerHTML = '';
  
  // Create canvas (even if empty)
  const { wrapper, canvas, connectionsLayer, nodesLayer, zoomControls } = createGraphCanvas();
  container.appendChild(wrapper);
  
  if (roots.length === 0) {
    // Empty graph - just show canvas with controls, no nodes
    // Set minimal SVG size
    connectionsLayer.setAttribute('width', 100);
    connectionsLayer.setAttribute('height', 100);
    connectionsLayer.style.width = '100px';
    connectionsLayer.style.height = '100px';
    
    // Setup pan/zoom for empty canvas (with no initial translate)
    setupPanZoom(wrapper, canvas, { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 }, { x: 0, y: 0 }, zoomControls, null);
    
    return null;
  }
  
  // Calculate layout for all trees in the forest
  const positions = calculateForestLayout(roots);
  const bounds = getCanvasBounds(positions);
  
  // Set SVG size
  connectionsLayer.setAttribute('width', bounds.width);
  connectionsLayer.setAttribute('height', bounds.height);
  connectionsLayer.style.width = `${bounds.width}px`;
  connectionsLayer.style.height = `${bounds.height}px`;
  
  // Get path to current node for highlighting (search across all roots)
  const pathNodeIds = currentId ? getPathToNodeInForest(roots, currentId) : null;
  
  // Draw connections for each tree
  roots.forEach((root) => {
    drawConnections(root, positions, connectionsLayer, pathNodeIds);
  });
  
  // Create nodes
  positions.forEach((pos) => {
    const nodeEl = createGraphNode(pos.node, pos, currentId, onNavigate, openNodeIds);
    nodesLayer.appendChild(nodeEl);
  });
  
  // Calculate initial translation - center tree in viewport
  const wrapperRect = wrapper.getBoundingClientRect();
  const treeWidth = bounds.maxX - bounds.minX + PADDING * 2;
  const treeHeight = bounds.maxY - bounds.minY + PADDING * 2;
  
  // Check if tree fits in viewport at 1x scale
  const fitsHorizontally = treeWidth <= wrapperRect.width * 0.9;
  const fitsVertically = treeHeight <= wrapperRect.height * 0.9;
  
  let initialTranslate = { x: 0, y: 0 };
  
  if (fitsHorizontally && fitsVertically) {
    // Tree fits - center it in viewport
    initialTranslate = {
      x: (wrapperRect.width - treeWidth) / 2 - (bounds.minX - PADDING),
      y: (wrapperRect.height - treeHeight) / 2 - (bounds.minY - PADDING)
    };
  } else {
    // Tree doesn't fit - will use fitToView in setupPanZoom
    initialTranslate = { x: 0, y: 0 };
  }
  
  // Setup pan/zoom after adding to DOM
  setupPanZoom(wrapper, canvas, bounds, initialTranslate, zoomControls, currentId);
  
  return currentId;
}

// Register the renderer
registerRenderer(VIEW_MODE.GRAPH, renderGraphView);

/**
 * Get the graph API for external control (centering, etc.)
 * @returns {{ centerOnNode: Function, wrapper: HTMLElement } | null}
 */
export function getGraphAPI() {
  return graphAPI;
}

export { renderGraphView };
