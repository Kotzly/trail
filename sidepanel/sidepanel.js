/**
 * Side Panel UI for Trail.
 * Displays the navigation tree for the current tab/window.
 * Supports both single-tab and multi-tab modes.
 */

// Import renderers to register them
import '../lib/tree-renderer.js';
import '../lib/stack-renderer.js';
import '../lib/graph-renderer.js';
import { getRenderer } from '../lib/renderers.js';
import { DEFAULT_VIEW_MODE } from '../lib/view-modes.js';
import { getGraphAPI } from '../lib/graph-renderer.js';

let currentTabId = null;
let currentWindowId = null;
let settings = null;
let currentNodeId = null; // Track which node is currently active
let openNodeIds = new Set(); // Nodes with open tabs (multi-tab mode)
let isMultiTabMode = false; // Whether multi-tab is enabled for current window

const DEFAULT_SETTINGS = {
  maxCachedLinks: 10,
  stackCapacity: 100,
  viewMode: DEFAULT_VIEW_MODE,
  theme: 'system',
  multiTabEnabled: false,
  multiTabLimit: 0,
  forestMode: true,
  backOnRevisit: true,
  compactGraph: false
};

/**
 * Apply theme to document.
 * @param {string} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || 'system');
}

/**
 * Send message to service worker.
 * @param {object} message
 * @returns {Promise<any>}
 */
async function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response?.success) {
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

/**
 * Handle navigation to a node (used by renderers).
 * @param {object} node - The node to navigate to
 */
async function handleNodeNavigation(node) {
  try {
    // Always send windowId and tabId - service worker decides the mode
    await sendMessage({
      type: 'NAVIGATE_TO',
      windowId: currentWindowId,
      tabId: currentTabId,
      url: node.url,
      nodeId: node.id
    });

    updateCurrentSelection(node.id);
  } catch (error) {
    console.error('Navigation failed:', error);
  }
}

/**
 * Update visual selection to show current node.
 * @param {number} nodeId - ID of the current node
 */
function updateCurrentSelection(nodeId) {
  currentNodeId = nodeId;
  // Update both tree-node and stack-entry elements
  const nodes = document.querySelectorAll('.tree-node, .stack-entry');
  nodes.forEach(node => {
    const id = parseInt(node.dataset.nodeId, 10);
    node.classList.toggle('current', id === nodeId);
  });
}

// Tab states (muted, audible) for nodes
let tabStates = {};

/**
 * Render the navigation data using the current view mode.
 * @param {object} treeData - Serialized tree data
 * @param {number[]} [openNodes] - IDs of nodes with open tabs (multi-tab mode)
 * @param {object} [states] - Tab states (muted, audible) by nodeId
 */
function renderView(treeData, openNodes = null, states = null) {
  const stackList = document.getElementById('stackList');
  const emptyState = document.getElementById('emptyState');
  const stackCount = document.getElementById('stackCount');
  
  // Store for context menu node lookup
  lastTreeData = treeData;
  
  // Update open nodes set
  if (openNodes !== null) {
    openNodeIds = new Set(openNodes);
  }
  
  // Update tab states
  if (states !== null) {
    tabStates = states;
  }
  
  const nodeCount = treeData?.nodeCount || 0;
  
  // Update count
  if (isMultiTabMode) {
    const openCount = openNodeIds.size;
    stackCount.textContent = `${nodeCount} page${nodeCount !== 1 ? 's' : ''} (${openCount} open)`;
  } else {
    stackCount.textContent = `${nodeCount} page${nodeCount !== 1 ? 's' : ''}`;
  }
  
  // Show/hide empty state
  if (!treeData?.root) {
    emptyState.classList.remove('hidden');
    stackList.innerHTML = '';
    return;
  }
  
  emptyState.classList.add('hidden');
  
  // Get the appropriate renderer
  const viewMode = settings?.viewMode || DEFAULT_VIEW_MODE;
  const renderer = getRenderer(viewMode);
  
  if (!renderer) {
    console.error(`No renderer found for view mode: ${viewMode}`);
    return;
  }
  
  // Render using the selected view mode
  currentNodeId = renderer(treeData, stackList, {
    onNavigate: handleNodeNavigation,
    openNodeIds: isMultiTabMode ? openNodeIds : null,
    compactGraph: settings?.compactGraph || false,
    tabStates: isMultiTabMode ? tabStates : {}
  });

  // Graph view handles centering internally, only scroll for other views
  if (!getGraphAPI()) {
    scrollToCurrentNode();
  }
}

/**
 * Scroll the container to show the current node.
 */
function scrollToCurrentNode() {
  const currentNode = document.querySelector('.tree-node.current, .stack-entry.current');
  if (currentNode) {
    currentNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Load and display tree for current tab/window.
 */
async function loadCurrentTab() {
  try {
    // Get current tab
    const { tab } = await sendMessage({ type: 'GET_CURRENT_TAB' });
    
    if (!tab?.id) {
      console.error('No current tab found');
      return;
    }
    
    currentTabId = tab.id;
    currentWindowId = tab.windowId;
    
    // Load settings
    const settingsResponse = await sendMessage({ type: 'GET_SETTINGS' });
    settings = settingsResponse.settings;
    
    // Apply theme
    applyTheme(settings.theme);
    
    // Load tree (always per-window now)
    const response = await sendMessage({ type: 'GET_TREE', tabId: currentTabId });
    
    // Store multi-tab mode state for this window
    isMultiTabMode = response.multiTabMode || false;
    
    if (isMultiTabMode) {
      renderView(response.tree, response.openNodeIds, response.tabStates);
    } else {
      renderView(response.tree);
    }
  } catch (error) {
    console.error('Failed to load current tab:', error);
  }
}

/**
 * Initialize event listeners.
 */
function initEventListeners() {
  // Clear button
  document.getElementById('clearBtn').addEventListener('click', async () => {
    if (!currentTabId) return;
    
    try {
      await sendMessage({ type: 'CLEAR_TREE', tabId: currentTabId });
    } catch (error) {
      console.error('Failed to clear tree:', error);
    }
  });
  
  // Settings button - toggle settings popover at click position
  document.getElementById('settingsBtn').addEventListener('click', (e) => {
    toggleSettingsPopover(e);
  });
  
  // Close popover when clicking outside
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('settingsPopover');
    const settingsBtn = document.getElementById('settingsBtn');
    
    if (!popover.classList.contains('hidden') && 
        !popover.contains(e.target) && 
        !settingsBtn.contains(e.target)) {
      popover.classList.add('hidden');
    }
  });
  
  // Theme icon clicks - save immediately
  document.querySelectorAll('#themeIcons .popover-icon-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const theme = btn.dataset.theme;
      updateThemeIcons(theme);
      applyTheme(theme);
      await saveSettingsQuick({ theme });
    });
  });
  
  // View mode icon clicks - save immediately
  document.querySelectorAll('#viewModeIcons .popover-icon-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mode = btn.dataset.mode;
      updateViewModeIcons(mode);
      await saveSettingsQuick({ viewMode: mode });
      
      // Show/hide compact graph option based on view mode
      const compactGraphOption = document.getElementById('compactGraphOption');
      if (compactGraphOption) {
        compactGraphOption.style.display = mode === 'graph' ? 'flex' : 'none';
      }
      
      // Re-render with new view mode
      if (currentTabId) {
        const response = await sendMessage({ type: 'GET_TREE', tabId: currentTabId });
        if (response.multiTabMode) {
          renderView(response.tree, response.openNodeIds, response.tabStates);
        } else {
          renderView(response.tree);
        }
      }
    });
  });
  
  // Multi-Tab global toggle
  const multiTabToggle = document.getElementById('multiTabToggle');
  const multiTabOptions = document.getElementById('multiTabOptions');
  
  multiTabToggle.addEventListener('change', async () => {
    const enabled = multiTabToggle.checked;
    multiTabOptions.classList.toggle('visible', enabled);
    await saveSettingsQuick({ multiTabEnabled: enabled });
    
    // Reload current tab to apply mode change
    loadCurrentTab();
  });
  
  // Multi-Tab per-window toggle
  const windowMultiTabToggle = document.getElementById('windowMultiTabToggle');
  
  windowMultiTabToggle.addEventListener('change', async () => {
    const enabled = windowMultiTabToggle.checked;
    await sendMessage({ 
      type: 'SET_WINDOW_MULTI_TAB', 
      windowId: currentWindowId, 
      enabled 
    });
    
    // Reload to apply
    loadCurrentTab();
  });
  
  // Multi-Tab help button
  const helpBtn = document.getElementById('multiTabHelpBtn');
  const helpPanel = document.getElementById('multiTabHelp');
  
  helpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    helpBtn.classList.toggle('active');
    helpPanel.classList.toggle('hidden');
  });
  
  // Multi-Tab limit input
  const multiTabLimit = document.getElementById('multiTabLimit');
  let limitTimeout = null;
  
  multiTabLimit.addEventListener('input', () => {
    // Debounce the save
    if (limitTimeout) clearTimeout(limitTimeout);
    limitTimeout = setTimeout(async () => {
      const limit = Math.max(0, parseInt(multiTabLimit.value, 10) || 0);
      await saveSettingsQuick({ multiTabLimit: limit });
    }, 300);
  });
  
  // Forest Mode toggle
  const forestModeToggle = document.getElementById('forestModeToggle');
  
  forestModeToggle.addEventListener('change', async () => {
    const enabled = forestModeToggle.checked;
    await saveSettingsQuick({ forestMode: enabled });
  });
  
  // Back on Revisit toggle
  const backOnRevisitToggle = document.getElementById('backOnRevisitToggle');
  
  backOnRevisitToggle.addEventListener('change', async () => {
    const enabled = backOnRevisitToggle.checked;
    await saveSettingsQuick({ backOnRevisit: enabled });
  });
  
  // Compact Graph toggle
  const compactGraphToggle = document.getElementById('compactGraphToggle');
  const compactGraphOption = document.getElementById('compactGraphOption');
  
  compactGraphToggle.addEventListener('change', async () => {
    const enabled = compactGraphToggle.checked;
    await saveSettingsQuick({ compactGraph: enabled });
    
    // Re-render to apply compact mode
    if (currentTabId) {
      const response = await sendMessage({ type: 'GET_TREE', tabId: currentTabId });
      if (response.multiTabMode) {
        renderView(response.tree, response.openNodeIds, response.tabStates);
      } else {
        renderView(response.tree);
      }
    }
  });
  
  // Listen for tree updates from service worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TREE_UPDATED' && message.tabId === currentTabId) {
      renderView(message.tree);
    } else if (message.type === 'GLOBAL_TREE_UPDATED') {
      // Global tree update - all sidepanels receive this
      renderView(message.tree, message.openNodeIds, message.tabStates);
    } else if (message.type === 'WINDOW_TREE_UPDATED' && message.windowId === currentWindowId) {
      // Legacy per-window tree update (single-tab mode)
      renderView(message.tree, message.openNodeIds, message.tabStates);
    }
  });
  
  // Listen for tab activation changes
  chrome.tabs.onActivated.addListener((activeInfo) => {
    if (activeInfo.tabId !== currentTabId) {
      currentTabId = activeInfo.tabId;
      loadCurrentTab();
    }
  });
  
  // Listen for storage changes (settings updates from other places)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.settings) {
      settings = changes.settings.newValue;
      
      // Apply theme
      applyTheme(settings.theme);
      
      // Re-render tree
      if (currentTabId) {
        sendMessage({ type: 'GET_TREE', tabId: currentTabId })
          .then(({ tree }) => renderView(tree))
          .catch(console.error);
      }
    }
  });
}

/**
 * Toggle settings popover at button position.
 * @param {MouseEvent} e
 */
function toggleSettingsPopover(e) {
  const popover = document.getElementById('settingsPopover');
  const btn = document.getElementById('settingsBtn');
  
  if (!popover.classList.contains('hidden')) {
    popover.classList.add('hidden');
    return;
  }
  
  // Position popover near button
  const btnRect = btn.getBoundingClientRect();
  const popoverWidth = 172; // Approximate width
  
  // Position to the left of button, below it
  let left = btnRect.right - popoverWidth;
  let top = btnRect.bottom + 8;
  
  // Ensure it fits in viewport
  if (left < 8) left = 8;
  if (top + 200 > window.innerHeight) {
    top = btnRect.top - 8;
    popover.style.transform = 'translateY(-100%)';
  } else {
    popover.style.transform = '';
  }
  
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  
  // Update active states
  updateThemeIcons(settings?.theme || DEFAULT_SETTINGS.theme);
  updateViewModeIcons(settings?.viewMode || DEFAULT_SETTINGS.viewMode);
  updateMultiTabUI(settings?.multiTabEnabled || false, settings?.multiTabLimit || 0, settings?.forestMode);
  updateNavigationUI(settings?.backOnRevisit, settings?.compactGraph, settings?.viewMode);
  
  popover.classList.remove('hidden');
}

/**
 * Update theme icons active state.
 * @param {string} theme
 */
function updateThemeIcons(theme) {
  document.querySelectorAll('#themeIcons .popover-icon-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

/**
 * Update view mode icons active state.
 * @param {string} mode
 */
function updateViewModeIcons(mode) {
  document.querySelectorAll('#viewModeIcons .popover-icon-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}

/**
 * Update Multi-Tab UI state.
 * @param {boolean} globalEnabled
 * @param {number} limit
 * @param {boolean} forestMode
 */
async function updateMultiTabUI(globalEnabled, limit, forestMode) {
  const globalToggle = document.getElementById('multiTabToggle');
  const windowToggle = document.getElementById('windowMultiTabToggle');
  const options = document.getElementById('multiTabOptions');
  const limitInput = document.getElementById('multiTabLimit');
  const helpBtn = document.getElementById('multiTabHelpBtn');
  const helpPanel = document.getElementById('multiTabHelp');
  const forestModeToggle = document.getElementById('forestModeToggle');
  
  // Reset help panel
  helpBtn.classList.remove('active');
  helpPanel.classList.add('hidden');
  
  // Set global toggle
  globalToggle.checked = globalEnabled;
  options.classList.toggle('visible', globalEnabled);
  limitInput.value = limit;
  
  // Set forest mode toggle
  forestModeToggle.checked = forestMode !== false;
  
  // Get per-window state
  if (currentWindowId) {
    try {
      const response = await sendMessage({ 
        type: 'GET_WINDOW_MULTI_TAB', 
        windowId: currentWindowId 
      });
      windowToggle.checked = response.enabled;
    } catch (e) {
      windowToggle.checked = globalEnabled;
    }
  }
}

/**
 * Update navigation UI state.
 * @param {boolean} backOnRevisit
 * @param {boolean} compactGraph
 * @param {string} viewMode
 */
function updateNavigationUI(backOnRevisit, compactGraph, viewMode) {
  const backOnRevisitToggle = document.getElementById('backOnRevisitToggle');
  const compactGraphToggle = document.getElementById('compactGraphToggle');
  const compactGraphOption = document.getElementById('compactGraphOption');
  
  // Set toggle states
  backOnRevisitToggle.checked = backOnRevisit !== false;
  compactGraphToggle.checked = compactGraph === true;
  
  // Show compact graph option only when graph view is selected
  if (compactGraphOption) {
    compactGraphOption.style.display = viewMode === 'graph' ? 'flex' : 'none';
  }
}

/**
 * Save settings quickly (for popover - immediate save).
 * @param {object} updates - Partial settings to update
 */
async function saveSettingsQuick(updates) {
  const newSettings = { ...settings, ...updates };
  
  try {
    await sendMessage({ type: 'SAVE_SETTINGS', settings: newSettings });
    settings = newSettings;
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

// ========================================
// CONTEXT MENU
// ========================================

let contextMenuNode = null; // Node that was right-clicked
let contextMenuTabInfo = null; // Tab info for the node (multi-tab mode)

/**
 * Show context menu at position.
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {object} node - The node data
 */
async function showContextMenu(x, y, node) {
  const menu = document.getElementById('contextMenu');
  contextMenuNode = node;
  
  // Get tab info if in multi-tab mode
  contextMenuTabInfo = null;
  if (settings?.multiTabEnabled) {
    try {
      const response = await sendMessage({ 
        type: 'GET_TAB_FOR_NODE', 
        windowId: currentWindowId, 
        nodeId: node.id 
      });
      contextMenuTabInfo = response.tabInfo;
    } catch (e) {
      // Tab might not exist
    }
  }
  
  // Update menu items based on state
  updateContextMenuItems();
  
  // Position menu
  menu.classList.remove('hidden');
  
  const menuRect = menu.getBoundingClientRect();
  let left = x;
  let top = y;
  
  // Keep within viewport
  if (left + menuRect.width > window.innerWidth) {
    left = window.innerWidth - menuRect.width - 8;
  }
  if (top + menuRect.height > window.innerHeight) {
    top = window.innerHeight - menuRect.height - 8;
  }
  
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

/**
 * Hide context menu.
 */
function hideContextMenu() {
  const menu = document.getElementById('contextMenu');
  menu.classList.add('hidden');
  contextMenuNode = null;
  contextMenuTabInfo = null;
}

/**
 * Update context menu items based on current state.
 */
function updateContextMenuItems() {
  const isMultiTab = settings?.multiTabEnabled;
  const hasOpenTab = contextMenuTabInfo !== null;
  
  // Show/hide multi-tab only items
  document.querySelectorAll('.context-menu-item.multi-tab-only').forEach(item => {
    item.classList.toggle('hidden-item', !isMultiTab);
  });
  
  // Update mute label
  if (contextMenuTabInfo) {
    const muteLabel = document.querySelector('.mute-label');
    muteLabel.textContent = contextMenuTabInfo.mutedInfo?.muted ? 'Unmute Tab' : 'Mute Tab';
    
    const pinLabel = document.querySelector('.pin-label');
    pinLabel.textContent = contextMenuTabInfo.pinned ? 'Unpin Tab' : 'Pin Tab';
  }
  
  // Disable tab actions if tab is not open
  document.querySelectorAll('[data-action="muteTab"], [data-action="pinTab"], [data-action="duplicateTab"], [data-action="closeTab"]').forEach(item => {
    item.classList.toggle('disabled', !hasOpenTab);
  });
}

/**
 * Handle context menu action.
 * @param {string} action - The action to perform
 */
async function handleContextMenuAction(action) {
  if (!contextMenuNode) return;
  
  const node = contextMenuNode;
  const tabInfo = contextMenuTabInfo;
  
  hideContextMenu();
  
  try {
    switch (action) {
      case 'open':
        handleNodeNavigation(node);
        break;
        
      case 'openNewTab':
        await chrome.tabs.create({ url: node.url, active: false });
        break;
        
      case 'openNewWindow':
        await chrome.windows.create({ url: node.url });
        break;
        
      case 'copyUrl':
        await navigator.clipboard.writeText(node.url);
        break;
        
      case 'copyTitle':
        await navigator.clipboard.writeText(node.title || 'Untitled');
        break;
        
      case 'muteTab':
        if (tabInfo) {
          await chrome.tabs.update(tabInfo.id, { muted: !tabInfo.mutedInfo?.muted });
        }
        break;
        
      case 'pinTab':
        if (tabInfo) {
          await chrome.tabs.update(tabInfo.id, { pinned: !tabInfo.pinned });
        }
        break;
        
      case 'duplicateTab':
        if (tabInfo) {
          await chrome.tabs.duplicate(tabInfo.id);
        }
        break;
        
      case 'closeTab':
        if (tabInfo) {
          await chrome.tabs.remove(tabInfo.id);
        }
        break;
        
      case 'removeFromHistory':
        await sendMessage({ 
          type: 'REMOVE_NODE', 
          tabId: currentTabId,
          windowId: currentWindowId,
          nodeId: node.id 
        });
        break;
    }
  } catch (error) {
    console.error(`Context menu action "${action}" failed:`, error);
  }
}

/**
 * Initialize context menu listeners.
 */
function initContextMenu() {
  const menu = document.getElementById('contextMenu');
  
  // Handle menu item clicks
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('.context-menu-item');
    if (item && !item.classList.contains('disabled')) {
      handleContextMenuAction(item.dataset.action);
    }
  });
  
  // Hide menu on click outside
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) {
      hideContextMenu();
    }
  });
  
  // Hide menu on scroll
  document.getElementById('stackContainer').addEventListener('scroll', hideContextMenu);
  
  // Listen for contextmenu on nodes (delegated)
  document.getElementById('stackList').addEventListener('contextmenu', (e) => {
    const nodeEl = e.target.closest('.tree-node, .stack-entry, .graph-node');
    if (nodeEl) {
      e.preventDefault();
      
      // Find node data from the tree
      const nodeId = parseInt(nodeEl.dataset.nodeId, 10);
      const nodeData = findNodeById(nodeId);
      
      if (nodeData) {
        showContextMenu(e.clientX, e.clientY, nodeData);
      }
    }
  });
}

/**
 * Find node by ID in the current tree data.
 * @param {number} nodeId
 * @returns {object|null}
 */
function findNodeById(nodeId) {
  // We need to search the rendered tree
  // Store the tree data globally for this purpose
  return findNodeInTree(lastTreeData?.root, nodeId);
}

/**
 * Recursively find node in tree.
 * @param {object} node
 * @param {number} targetId
 * @returns {object|null}
 */
function findNodeInTree(node, targetId) {
  if (!node) return null;
  if (node.id === targetId) return node;
  
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeInTree(child, targetId);
      if (found) return found;
    }
  }
  
  return null;
}

// Store last tree data for node lookup
let lastTreeData = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  // CRITICAL: Get window ID BEFORE adding message listeners
  // This ensures we know which window we're in before any messages arrive
  try {
    const window = await chrome.windows.getCurrent();
    currentWindowId = window.id;
  } catch (error) {
    console.error('Failed to get current window:', error);
  }

  initEventListeners();
  initContextMenu();
  loadCurrentTab();
});
