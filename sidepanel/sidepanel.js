/**
 * Side Panel UI for Stack History.
 * Displays the navigation tree for the current tab.
 */

// Import renderers to register them
import '../lib/tree-renderer.js';
import '../lib/stack-renderer.js';
import { getRenderer } from '../lib/renderers.js';
import { getViewModes, DEFAULT_VIEW_MODE } from '../lib/view-modes.js';

let currentTabId = null;
let settings = null;
let currentNodeId = null; // Track which node is currently active

const DEFAULT_SETTINGS = {
  maxCachedLinks: 10,
  stackCapacity: 100,
  viewMode: DEFAULT_VIEW_MODE,
  theme: 'system'
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
    await sendMessage({
      type: 'NAVIGATE_TO',
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

/**
 * Render the navigation data using the current view mode.
 * @param {object} treeData - Serialized tree data
 */
function renderView(treeData) {
  const stackList = document.getElementById('stackList');
  const emptyState = document.getElementById('emptyState');
  const stackCount = document.getElementById('stackCount');
  
  const nodeCount = treeData?.nodeCount || 0;
  
  // Update count
  stackCount.textContent = `${nodeCount} page${nodeCount !== 1 ? 's' : ''}`;
  
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
    onNavigate: handleNodeNavigation
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
 * Load and display tree for current tab.
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
    
    // Load settings
    const settingsResponse = await sendMessage({ type: 'GET_SETTINGS' });
    settings = settingsResponse.settings;
    
    // Apply theme
    applyTheme(settings.theme);
    
    // Load tree for this tab
    const { tree } = await sendMessage({ type: 'GET_TREE', tabId: currentTabId });
    renderView(tree);
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
  
  // Settings button - toggle settings panel
  document.getElementById('settingsBtn').addEventListener('click', () => {
    openSettingsPanel();
  });
  
  // Close settings button
  document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    closeSettingsPanel();
  });
  
  // Save settings button
  document.getElementById('saveBtn').addEventListener('click', () => {
    saveSettings();
  });
  
  // Reset settings button
  document.getElementById('resetBtn').addEventListener('click', () => {
    resetSettings();
  });
  
  // Theme option clicks
  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const theme = opt.dataset.theme;
      updateThemeSelection(theme);
      applyTheme(theme);
    });
  });
  
  // Listen for tree updates from service worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TREE_UPDATED' && message.tabId === currentTabId) {
      renderView(message.tree);
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
 * Open settings panel and populate with current settings.
 */
function openSettingsPanel() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.remove('hidden');
  
  // Populate current values
  document.getElementById('stackCapacity').value = settings?.stackCapacity || DEFAULT_SETTINGS.stackCapacity;
  updateThemeSelection(settings?.theme || DEFAULT_SETTINGS.theme);
  updateViewModeSelection(settings?.viewMode || DEFAULT_SETTINGS.viewMode);
}

/**
 * Close settings panel.
 */
function closeSettingsPanel() {
  const panel = document.getElementById('settingsPanel');
  panel.classList.add('hidden');
}

/**
 * Initialize view mode options UI.
 */
function initViewModeOptions() {
  const container = document.getElementById('viewModeOptions');
  const viewModes = getViewModes();
  
  viewModes.forEach(mode => {
    const option = document.createElement('label');
    option.className = 'view-mode-option';
    option.dataset.mode = mode.id;
    
    option.innerHTML = `
      <input type="radio" name="viewMode" value="${mode.id}">
      <div class="view-mode-radio"></div>
      <div class="view-mode-icon">${mode.icon}</div>
      <div class="view-mode-content">
        <div class="view-mode-label">${mode.label}</div>
        <div class="view-mode-description">${mode.description}</div>
      </div>
    `;
    
    option.addEventListener('click', () => {
      updateViewModeSelection(mode.id);
    });
    
    container.appendChild(option);
  });
}

/**
 * Update view mode selection UI.
 * @param {string} modeId
 */
function updateViewModeSelection(modeId) {
  const options = document.querySelectorAll('.view-mode-option');
  options.forEach(opt => {
    const isSelected = opt.dataset.mode === modeId;
    opt.classList.toggle('selected', isSelected);
    opt.querySelector('input[type="radio"]').checked = isSelected;
  });
}

/**
 * Update theme selection UI.
 * @param {string} theme
 */
function updateThemeSelection(theme) {
  const options = document.querySelectorAll('.theme-option');
  options.forEach(opt => {
    const isSelected = opt.dataset.theme === theme;
    opt.classList.toggle('selected', isSelected);
    opt.querySelector('input[type="radio"]').checked = isSelected;
  });
}

/**
 * Save settings.
 */
async function saveSettings() {
  const selectedViewMode = document.querySelector('input[name="viewMode"]:checked')?.value || DEFAULT_VIEW_MODE;
  const selectedTheme = document.querySelector('input[name="theme"]:checked')?.value || 'system';
  const stackCapacity = parseInt(document.getElementById('stackCapacity').value, 10);
  
  // Validation
  if (stackCapacity < 10 || stackCapacity > 1000) {
    alert('Stack capacity must be between 10 and 1000');
    return;
  }
  
  const newSettings = {
    ...settings,
    stackCapacity,
    viewMode: selectedViewMode,
    theme: selectedTheme
  };
  
  try {
    await sendMessage({ type: 'SAVE_SETTINGS', settings: newSettings });
    settings = newSettings;
    closeSettingsPanel();
    
    // Re-render with new view mode
    if (currentTabId) {
      const { tree } = await sendMessage({ type: 'GET_TREE', tabId: currentTabId });
      renderView(tree);
    }
  } catch (error) {
    console.error('Failed to save settings:', error);
    alert('Failed to save settings');
  }
}

/**
 * Reset settings to defaults.
 */
async function resetSettings() {
  try {
    await sendMessage({ type: 'SAVE_SETTINGS', settings: DEFAULT_SETTINGS });
    settings = DEFAULT_SETTINGS;
    
    document.getElementById('stackCapacity').value = DEFAULT_SETTINGS.stackCapacity;
    updateViewModeSelection(DEFAULT_SETTINGS.viewMode);
    updateThemeSelection(DEFAULT_SETTINGS.theme);
    applyTheme(DEFAULT_SETTINGS.theme);
  } catch (error) {
    console.error('Failed to reset settings:', error);
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initViewModeOptions();
  initEventListeners();
  loadCurrentTab();
});
