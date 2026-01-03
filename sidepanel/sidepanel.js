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

let currentTabId = null;
let currentWindowId = null;
let settings = null;
let currentNodeId = null; // Track which node is currently active
let openNodeIds = new Set(); // Nodes with open tabs (multi-tab mode)

const DEFAULT_SETTINGS = {
  maxCachedLinks: 10,
  stackCapacity: 100,
  viewMode: DEFAULT_VIEW_MODE,
  theme: 'system',
  multiTabEnabled: false,
  multiTabLimit: 0
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
    if (settings?.multiTabEnabled) {
      // Multi-tab mode: include windowId
      await sendMessage({
        type: 'NAVIGATE_TO',
        windowId: currentWindowId,
        url: node.url,
        nodeId: node.id
      });
    } else {
      // Single-tab mode
      await sendMessage({
        type: 'NAVIGATE_TO',
        tabId: currentTabId,
        url: node.url,
        nodeId: node.id
      });
    }
    
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

/**
 * Render the navigation data using the current view mode.
 * @param {object} treeData - Serialized tree data
 * @param {number[]} [openNodes] - IDs of nodes with open tabs (multi-tab mode)
 */
function renderView(treeData, openNodes = null) {
  const stackList = document.getElementById('stackList');
  const emptyState = document.getElementById('emptyState');
  const stackCount = document.getElementById('stackCount');
  
  // Update open nodes set
  if (openNodes !== null) {
    openNodeIds = new Set(openNodes);
  }
  
  const nodeCount = treeData?.nodeCount || 0;
  
  // Update count
  if (settings?.multiTabEnabled) {
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
    openNodeIds: settings?.multiTabEnabled ? openNodeIds : null
  });
  
  // Scroll to current node
  scrollToCurrentNode();
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
    
    // Load tree
    const response = await sendMessage({ type: 'GET_TREE', tabId: currentTabId });
    
    if (response.multiTabMode) {
      // Multi-tab mode: got window tree
      renderView(response.tree, response.openNodeIds);
    } else {
      // Single-tab mode
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
      
      // Re-render with new view mode
      if (currentTabId) {
        const response = await sendMessage({ type: 'GET_TREE', tabId: currentTabId });
        if (response.multiTabMode) {
          renderView(response.tree, response.openNodeIds);
        } else {
          renderView(response.tree);
        }
      }
    });
  });
  
  // Multi-Tab toggle
  const multiTabToggle = document.getElementById('multiTabToggle');
  const multiTabOptions = document.getElementById('multiTabOptions');
  
  multiTabToggle.addEventListener('change', async () => {
    const enabled = multiTabToggle.checked;
    multiTabOptions.classList.toggle('visible', enabled);
    await saveSettingsQuick({ multiTabEnabled: enabled });
    
    // Reload current tab to apply mode change
    loadCurrentTab();
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
  
  // Listen for tree updates from service worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TREE_UPDATED' && message.tabId === currentTabId) {
      renderView(message.tree);
    } else if (message.type === 'WINDOW_TREE_UPDATED' && message.windowId === currentWindowId) {
      renderView(message.tree, message.openNodeIds);
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
  updateMultiTabUI(settings?.multiTabEnabled || false, settings?.multiTabLimit || 0);
  
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
 * @param {boolean} enabled
 * @param {number} limit
 */
function updateMultiTabUI(enabled, limit) {
  const toggle = document.getElementById('multiTabToggle');
  const options = document.getElementById('multiTabOptions');
  const limitInput = document.getElementById('multiTabLimit');
  
  toggle.checked = enabled;
  options.classList.toggle('visible', enabled);
  limitInput.value = limit;
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

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadCurrentTab();
});
