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
let previousNodeId = null; // Track previous node for center animation
let openNodeIds = new Set(); // Nodes with open tabs (multi-tab mode)
let isMultiTabMode = false; // Whether multi-tab is enabled for current window
let lastTreeData = null; // Store tree data for search

// Search state
let searchResults = []; // Array of matching node IDs
let searchIndex = 0; // Current focused result index
let searchQuery = ''; // Current search query

// Pinned dropdown state
let pinnedNodes = []; // Array of pinned nodes
let pinnedFocusIndex = -1; // Current focused index in dropdown
let pinnedDropdownOpen = false;

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
  // For graph view, show empty canvas; for tree/stack views, show message
  const viewMode = settings?.viewMode || DEFAULT_VIEW_MODE;
  
  if (!treeData?.root) {
    if (viewMode === 'graph') {
      // Graph view: just hide empty state and show empty canvas
      emptyState.classList.add('hidden');
      stackList.innerHTML = '';
      
      // Render empty graph canvas
      const renderer = getRenderer(viewMode);
      if (renderer) {
        renderer({ roots: [], nodeCount: 0 }, stackList, {
          onNavigate: handleNodeNavigation,
          openNodeIds: isMultiTabMode ? openNodeIds : null,
          compactGraph: settings?.compactGraph || false,
          tabStates: isMultiTabMode ? tabStates : {}
        });
      }
    } else {
      // Tree/stack views: show empty state message
      emptyState.classList.remove('hidden');
      stackList.innerHTML = '';
    }
    return;
  }
  
  emptyState.classList.add('hidden');
  
  // Get the appropriate renderer
  const renderer = getRenderer(viewMode);
  
  if (!renderer) {
    console.error(`No renderer found for view mode: ${viewMode}`);
    return;
  }
  
  // Render using the selected view mode
  const newNodeId = renderer(treeData, stackList, {
    onNavigate: handleNodeNavigation,
    openNodeIds: isMultiTabMode ? openNodeIds : null,
    compactGraph: settings?.compactGraph || false,
    tabStates: isMultiTabMode ? tabStates : {},
    selectionMenuInstant: settings?.selectionMenuInstant || false
  });
  
  // Check if current node changed (navigation happened)
  const nodeChanged = previousNodeId !== null && newNodeId !== previousNodeId;
  previousNodeId = newNodeId;
  currentNodeId = newNodeId;

  // Center on new node with animation if it changed
  const graphAPI = getGraphAPI();
  if (graphAPI && nodeChanged && newNodeId) {
    graphAPI.centerOnNode(newNodeId, true);
  } else if (!graphAPI) {
    // Non-graph views: scroll to current node
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
  // Undo button
  document.getElementById('undoBtn').addEventListener('click', async () => {
    try {
      const response = await sendMessage({ type: 'UNDO' });
      if (response.success) {
        updateUndoRedoButtons(response.state);
      }
    } catch (error) {
      console.error('Failed to undo:', error);
    }
  });
  
  // Redo button
  document.getElementById('redoBtn').addEventListener('click', async () => {
    try {
      const response = await sendMessage({ type: 'REDO' });
      if (response.success) {
        updateUndoRedoButtons(response.state);
      }
    } catch (error) {
      console.error('Failed to redo:', error);
    }
  });
  
  // Keyboard shortcuts for undo/redo
  document.addEventListener('keydown', async (e) => {
    // Check for Cmd/Ctrl+Z (undo) or Cmd/Ctrl+Shift+Z (redo)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      
      if (e.shiftKey) {
        // Redo
        try {
          const response = await sendMessage({ type: 'REDO' });
          if (response.success) {
            updateUndoRedoButtons(response.state);
          }
        } catch (error) {
          console.error('Failed to redo:', error);
        }
      } else {
        // Undo
        try {
          const response = await sendMessage({ type: 'UNDO' });
          if (response.success) {
            updateUndoRedoButtons(response.state);
          }
        } catch (error) {
          console.error('Failed to undo:', error);
        }
      }
    }
  });
  
  // New window button - creates new window with new tree root
  document.getElementById('newTabBtn').addEventListener('click', async () => {
    try {
      await sendMessage({ type: 'CREATE_NEW_ROOT' });
    } catch (error) {
      console.error('Failed to create new window:', error);
    }
  });
  
  // Pinned dropdown button
  document.getElementById('pinnedBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    togglePinnedDropdown();
  });
  
  // Close pinned dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('pinnedDropdown');
    const pinnedBtn = document.getElementById('pinnedBtn');
    if (pinnedDropdownOpen && !dropdown.contains(e.target) && !pinnedBtn.contains(e.target)) {
      closePinnedDropdown();
    }
  });
  
  // Keyboard navigation for pinned dropdown
  document.addEventListener('keydown', (e) => {
    handlePinnedDropdownKeydown(e);
  });
  
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
  
  // Collapsible category headers - expand first one by default
  document.querySelectorAll('.settings-category .category-header').forEach((header, index) => {
    // Expand first category by default
    if (index === 0) {
      header.closest('.settings-category').classList.add('expanded');
    }
    
    header.addEventListener('click', () => {
      const category = header.closest('.settings-category');
      category.classList.toggle('expanded');
    });
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
  
  // Selection Menu Instant toggle
  const selectionMenuToggle = document.getElementById('selectionMenuToggle');
  
  selectionMenuToggle.addEventListener('change', async () => {
    const enabled = selectionMenuToggle.checked;
    await saveSettingsQuick({ selectionMenuInstant: enabled });
  });
  
  // Feature flag toggles
  const enableSearchToggle = document.getElementById('enableSearchToggle');
  const enablePinNodesToggle = document.getElementById('enablePinNodesToggle');
  const enableTagsToggle = document.getElementById('enableTagsToggle');
  
  enableSearchToggle.addEventListener('change', async () => {
    const enabled = enableSearchToggle.checked;
    await saveSettingsQuick({ enableSearch: enabled });
    updateFeatureUI(enabled, enablePinNodesToggle.checked, enableTagsToggle.checked, pinSyncBrowserToggle.checked);
  });
  
  enablePinNodesToggle.addEventListener('change', async () => {
    const enabled = enablePinNodesToggle.checked;
    await saveSettingsQuick({ enablePinNodes: enabled });
    // Show/hide pin sync option based on Pin Nodes toggle
    const pinSyncOption = document.getElementById('pinSyncOption');
    const pinSyncHint = document.getElementById('pinSyncHint');
    if (pinSyncOption) pinSyncOption.classList.toggle('hidden', !enabled);
    if (pinSyncHint) pinSyncHint.classList.toggle('hidden', !enabled);
  });
  
  // Pin sync with browser toggle
  const pinSyncBrowserToggle = document.getElementById('pinSyncBrowserToggle');
  pinSyncBrowserToggle.addEventListener('change', async () => {
    const enabled = pinSyncBrowserToggle.checked;
    await saveSettingsQuick({ pinSyncBrowser: enabled });
  });
  
  enableTagsToggle.addEventListener('change', async () => {
    const enabled = enableTagsToggle.checked;
    await saveSettingsQuick({ enableTags: enabled });
  });
  
  // Search functionality
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  const searchPrev = document.getElementById('searchPrev');
  const searchNext = document.getElementById('searchNext');
  
  let searchDebounce = null;
  
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      performSearch(e.target.value);
    }, 150);
  });
  
  searchClear.addEventListener('click', () => {
    clearSearch();
    searchInput.focus();
  });
  
  searchPrev.addEventListener('click', () => {
    focusSearchResult(searchIndex - 1);
  });
  
  searchNext.addEventListener('click', () => {
    focusSearchResult(searchIndex + 1);
  });
  
  // Keyboard shortcuts for search
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        const nodeId = searchResults[searchIndex];
        if (e.shiftKey) {
          // Shift+Enter: open in new tab
          chrome.runtime.sendMessage({ type: 'OPEN_IN_NEW_TAB', nodeId });
        } else {
          // Enter: navigate to the node
          const node = findNodeById(lastTreeData, nodeId);
          if (node) {
            handleNodeNavigation(node);
          }
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusSearchResult(searchIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusSearchResult(searchIndex - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      clearSearch();
    }
  });
  
  // Global Cmd/Ctrl+F to focus search
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      const searchBar = document.getElementById('searchBar');
      if (searchBar && !searchBar.classList.contains('hidden')) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });
  
  // Listen for tree updates from service worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TREE_UPDATED' && message.tabId === currentTabId) {
      renderView(message.tree);
      fetchUndoRedoState(); // Update undo/redo buttons
    } else if (message.type === 'GLOBAL_TREE_UPDATED') {
      // Global tree update - all sidepanels receive this
      renderView(message.tree, message.openNodeIds, message.tabStates);
      fetchUndoRedoState(); // Update undo/redo buttons
    } else if (message.type === 'WINDOW_TREE_UPDATED' && message.windowId === currentWindowId) {
      // Legacy per-window tree update (single-tab mode)
      renderView(message.tree, message.openNodeIds, message.tabStates);
      fetchUndoRedoState(); // Update undo/redo buttons
    }
  });
  
  // Listen for tab activation changes
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    // CRITICAL: Check if this tab was created programmatically FIRST
    // Check session storage (for race condition protection)
    const result = await chrome.storage.session.get(`programmaticTab_${activeInfo.tabId}`);
    
    if (result[`programmaticTab_${activeInfo.tabId}`]) {
      // This tab was created programmatically - do NOT switch focus
      // Remove flag so if user manually switches to it later, focus will switch
      await chrome.storage.session.remove(`programmaticTab_${activeInfo.tabId}`);
      return; // Exit early - do nothing
    }
    
    // Normal tab activation - update focus
    if (activeInfo.tabId !== currentTabId || activeInfo.windowId !== currentWindowId) {
      currentTabId = activeInfo.tabId;
      currentWindowId = activeInfo.windowId;
      loadCurrentTab();
    }
  });
  
  // Listen for window focus changes
  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    
    try {
      // Get active tab in the focused window
      const tabs = await chrome.tabs.query({ windowId, active: true });
      if (tabs.length > 0 && tabs[0].id !== currentTabId) {
        currentTabId = tabs[0].id;
        currentWindowId = windowId;
        loadCurrentTab();
      }
    } catch (error) {
      console.debug('Window focus change error:', error);
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
  updateNavigationUI(settings?.backOnRevisit, settings?.compactGraph, settings?.viewMode, settings?.selectionMenuInstant);
  updateFeatureUI(settings?.enableSearch, settings?.enablePinNodes, settings?.enableTags, settings?.pinSyncBrowser);
  
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
 * @param {boolean} selectionMenuInstant
 */
function updateNavigationUI(backOnRevisit, compactGraph, viewMode, selectionMenuInstant) {
  const backOnRevisitToggle = document.getElementById('backOnRevisitToggle');
  const compactGraphToggle = document.getElementById('compactGraphToggle');
  const compactGraphOption = document.getElementById('compactGraphOption');
  const selectionMenuToggle = document.getElementById('selectionMenuToggle');
  const selectionMenuOption = document.getElementById('selectionMenuOption');
  
  // Set toggle states
  backOnRevisitToggle.checked = backOnRevisit !== false;
  compactGraphToggle.checked = compactGraph === true;
  selectionMenuToggle.checked = selectionMenuInstant === true;
  
  // Show graph-only options only when graph view is selected
  if (compactGraphOption) {
    compactGraphOption.style.display = viewMode === 'graph' ? 'flex' : 'none';
  }
  if (selectionMenuOption) {
    selectionMenuOption.style.display = viewMode === 'graph' ? 'flex' : 'none';
  }
}

/**
 * Update undo/redo button states.
 * @param {object} state - { canUndo, canRedo, undoDescription, redoDescription }
 */
function updateUndoRedoButtons(state) {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  
  if (undoBtn) {
    undoBtn.disabled = !state.canUndo;
    undoBtn.title = state.undoDescription 
      ? `Undo: ${state.undoDescription} (Ctrl+Z)` 
      : 'Undo (Ctrl+Z)';
  }
  
  if (redoBtn) {
    redoBtn.disabled = !state.canRedo;
    redoBtn.title = state.redoDescription 
      ? `Redo: ${state.redoDescription} (Ctrl+Shift+Z)` 
      : 'Redo (Ctrl+Shift+Z)';
  }
}

/**
 * Fetch and update undo/redo state from service worker.
 */
async function fetchUndoRedoState() {
  try {
    const response = await sendMessage({ type: 'GET_UNDO_STATE' });
    if (response.success) {
      updateUndoRedoButtons(response.state);
    }
  } catch (error) {
    // Undo state not available
  }
}

/**
 * Update feature flags UI and show/hide related UI elements.
 * @param {boolean} enableSearch
 * @param {boolean} enablePinNodes
 * @param {boolean} enableTags
 * @param {boolean} pinSyncBrowser
 */
function updateFeatureUI(enableSearch, enablePinNodes, enableTags, pinSyncBrowser) {
  const enableSearchToggle = document.getElementById('enableSearchToggle');
  const enablePinNodesToggle = document.getElementById('enablePinNodesToggle');
  const enableTagsToggle = document.getElementById('enableTagsToggle');
  const pinSyncBrowserToggle = document.getElementById('pinSyncBrowserToggle');
  const searchBar = document.getElementById('searchBar');
  const pinSyncOption = document.getElementById('pinSyncOption');
  const pinSyncHint = document.getElementById('pinSyncHint');
  
  // Set toggle states
  if (enableSearchToggle) enableSearchToggle.checked = enableSearch !== false;
  if (enablePinNodesToggle) enablePinNodesToggle.checked = enablePinNodes !== false;
  if (enableTagsToggle) enableTagsToggle.checked = enableTags !== false;
  if (pinSyncBrowserToggle) pinSyncBrowserToggle.checked = pinSyncBrowser === true;
  
  // Show/hide search bar based on feature flag
  if (searchBar) {
    searchBar.classList.toggle('hidden', !enableSearch);
  }
  
  // Show/hide pin sync option based on Pin Nodes toggle
  if (pinSyncOption) pinSyncOption.classList.toggle('hidden', !enablePinNodes);
  if (pinSyncHint) pinSyncHint.classList.toggle('hidden', !enablePinNodes);
}

// ========================================
// SEARCH FUNCTIONALITY
// ========================================

/**
 * Search through tree data for matching nodes.
 * @param {string} query - Search query
 * @param {object} treeData - Tree data to search
 * @returns {number[]} - Array of matching node IDs
 */
function searchNodes(query, treeData) {
  if (!query || !treeData) return [];
  
  const q = query.toLowerCase().trim();
  if (!q) return [];
  
  const matches = [];
  
  // Recursive search through tree
  function searchNode(node) {
    if (!node) return;
    
    // Check title, url, domain
    const title = (node.title || '').toLowerCase();
    const url = (node.url || '').toLowerCase();
    let domain = '';
    try {
      domain = new URL(node.url).hostname.toLowerCase();
    } catch (e) {}
    
    if (title.includes(q) || url.includes(q) || domain.includes(q)) {
      matches.push(node.id);
    }
    
    // Search children
    if (node.children) {
      node.children.forEach(child => searchNode(child));
    }
  }
  
  // Search all roots (forest mode) or single root
  const roots = treeData.roots || (treeData.root ? [treeData.root] : []);
  roots.forEach(root => searchNode(root));
  
  return matches;
}

/**
 * Perform search and update UI.
 * @param {string} query - Search query
 */
function performSearch(query) {
  searchQuery = query;
  searchResults = searchNodes(query, lastTreeData);
  searchIndex = 0;
  
  updateSearchUI();
  applySearchHighlights();
  
  if (searchResults.length > 0) {
    focusSearchResult(0);
  }
}

/**
 * Update search UI with results count.
 */
function updateSearchUI() {
  const searchResultsEl = document.getElementById('searchResults');
  const searchCountEl = document.getElementById('searchCount');
  const searchClearEl = document.getElementById('searchClear');
  
  if (searchQuery) {
    searchResultsEl.classList.remove('hidden');
    searchClearEl.classList.remove('hidden');
    
    if (searchResults.length === 0) {
      searchCountEl.textContent = 'No results';
    } else {
      searchCountEl.textContent = `${searchIndex + 1} of ${searchResults.length}`;
    }
  } else {
    searchResultsEl.classList.add('hidden');
    searchClearEl.classList.add('hidden');
  }
}

/**
 * Apply search highlights to matching nodes.
 */
function applySearchHighlights() {
  // Remove existing highlights
  document.querySelectorAll('.search-match, .search-dimmed, .search-focused').forEach(el => {
    el.classList.remove('search-match', 'search-dimmed', 'search-focused');
  });
  
  if (!searchQuery || searchResults.length === 0) return;
  
  // Apply dimmed class to all nodes
  document.querySelectorAll('.graph-node, .tree-node, .stack-entry').forEach(el => {
    el.classList.add('search-dimmed');
  });
  
  // Apply match class to matching nodes
  searchResults.forEach((nodeId, idx) => {
    const el = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (el) {
      el.classList.remove('search-dimmed');
      el.classList.add('search-match');
      if (idx === searchIndex) {
        el.classList.add('search-focused');
      }
    }
  });
}

/**
 * Focus on a specific search result.
 * @param {number} index - Index in searchResults array
 */
function focusSearchResult(index) {
  if (searchResults.length === 0) return;
  
  searchIndex = ((index % searchResults.length) + searchResults.length) % searchResults.length;
  const nodeId = searchResults[searchIndex];
  
  updateSearchUI();
  applySearchHighlights();
  
  // Center on the node in graph view
  const graphAPI = getGraphAPI();
  if (graphAPI && graphAPI.centerOnNode) {
    graphAPI.centerOnNode(nodeId, true);
  } else {
    // Scroll into view for other views
    const el = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

/**
 * Clear search and reset UI.
 */
function clearSearch() {
  searchQuery = '';
  searchResults = [];
  searchIndex = 0;
  
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  
  updateSearchUI();
  applySearchHighlights();
}

// ========================================
// PINNED DROPDOWN FUNCTIONALITY
// ========================================

/**
 * Collect all pinned nodes from tree data.
 * @param {object} treeData - Tree data
 * @returns {Array} - Array of pinned nodes
 */
function collectPinnedNodes(treeData) {
  if (!treeData) return [];
  
  const pinned = [];
  
  function traverse(node) {
    if (!node) return;
    if (node.pinned) {
      pinned.push(node);
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  
  const roots = treeData.roots || (treeData.root ? [treeData.root] : []);
  roots.forEach(traverse);
  
  return pinned;
}

/**
 * Open pinned dropdown and populate with pinned nodes.
 */
function openPinnedDropdown() {
  const dropdown = document.getElementById('pinnedDropdown');
  const list = document.getElementById('pinnedList');
  const count = document.getElementById('pinnedCount');
  
  pinnedNodes = collectPinnedNodes(lastTreeData);
  pinnedFocusIndex = pinnedNodes.length > 0 ? 0 : -1;
  pinnedDropdownOpen = true;
  
  // Update count
  count.textContent = pinnedNodes.length.toString();
  
  // Populate list
  if (pinnedNodes.length === 0) {
    list.innerHTML = '<div class="pinned-dropdown-empty">No pinned pages</div>';
  } else {
    list.innerHTML = pinnedNodes.map((node, idx) => {
      let domain = '';
      try {
        domain = new URL(node.url).hostname;
      } catch (e) {
        domain = node.url;
      }
      
      return `
        <div class="pinned-dropdown-item${idx === 0 ? ' focused' : ''}" data-node-id="${node.id}">
          ${node.favicon 
            ? `<img class="pinned-dropdown-item-favicon" src="${node.favicon}" alt="">` 
            : `<div class="pinned-dropdown-item-favicon placeholder">📌</div>`}
          <div class="pinned-dropdown-item-info">
            <div class="pinned-dropdown-item-title">${node.title || 'Untitled'}</div>
            <div class="pinned-dropdown-item-url">${domain}</div>
          </div>
        </div>
      `;
    }).join('');
    
    // Add click handlers
    list.querySelectorAll('.pinned-dropdown-item').forEach((item, idx) => {
      item.addEventListener('click', () => {
        const nodeId = parseInt(item.dataset.nodeId, 10);
        const node = pinnedNodes.find(n => n.id === nodeId);
        if (node) {
          handleNodeNavigation(node);
          closePinnedDropdown();
        }
      });
      item.addEventListener('mouseenter', () => {
        updatePinnedFocus(idx);
      });
    });
  }
  
  dropdown.classList.remove('hidden');
}

/**
 * Close pinned dropdown.
 */
function closePinnedDropdown() {
  const dropdown = document.getElementById('pinnedDropdown');
  dropdown.classList.add('hidden');
  pinnedDropdownOpen = false;
  pinnedFocusIndex = -1;
}

/**
 * Toggle pinned dropdown.
 */
function togglePinnedDropdown() {
  if (pinnedDropdownOpen) {
    closePinnedDropdown();
  } else {
    openPinnedDropdown();
  }
}

/**
 * Update focus in pinned dropdown.
 * @param {number} newIndex - New focus index
 */
function updatePinnedFocus(newIndex) {
  if (pinnedNodes.length === 0) return;
  
  // Wrap around
  pinnedFocusIndex = ((newIndex % pinnedNodes.length) + pinnedNodes.length) % pinnedNodes.length;
  
  // Update visual focus
  const items = document.querySelectorAll('.pinned-dropdown-item');
  items.forEach((item, idx) => {
    item.classList.toggle('focused', idx === pinnedFocusIndex);
  });
  
  // Scroll into view
  if (items[pinnedFocusIndex]) {
    items[pinnedFocusIndex].scrollIntoView({ block: 'nearest' });
  }
}

/**
 * Handle keyboard navigation in pinned dropdown.
 * @param {KeyboardEvent} e
 */
function handlePinnedDropdownKeydown(e) {
  if (!pinnedDropdownOpen) return;
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      updatePinnedFocus(pinnedFocusIndex + 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      updatePinnedFocus(pinnedFocusIndex - 1);
      break;
    case 'Enter':
      e.preventDefault();
      if (pinnedFocusIndex >= 0 && pinnedFocusIndex < pinnedNodes.length) {
        const node = pinnedNodes[pinnedFocusIndex];
        handleNodeNavigation(node);
        closePinnedDropdown();
      }
      break;
    case 'Escape':
      e.preventDefault();
      closePinnedDropdown();
      break;
  }
}

/**
 * Find a node by ID in tree data.
 * @param {object} treeData - Tree data
 * @param {number} nodeId - Node ID to find
 * @returns {object|null} - Node object or null
 */
function findNodeById(treeData, nodeId) {
  if (!treeData) return null;
  
  function search(node) {
    if (!node) return null;
    if (node.id === nodeId) return node;
    
    if (node.children) {
      for (const child of node.children) {
        const found = search(child);
        if (found) return found;
      }
    }
    return null;
  }
  
  const roots = treeData.roots || (treeData.root ? [treeData.root] : []);
  for (const root of roots) {
    const found = search(root);
    if (found) return found;
  }
  return null;
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
        // Mark as programmatic BEFORE creating tab
        const tempId = `pending_${Date.now()}_${Math.random()}`;
        await chrome.storage.session.set({ [tempId]: true });
        const newTab = await chrome.tabs.create({ url: node.url, active: false });
        // Mark actual tab as programmatic
        await chrome.storage.session.set({ [`programmaticTab_${newTab.id}`]: true });
        await chrome.storage.session.remove(tempId);
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
      const nodeData = findNodeById(lastTreeData, nodeId);
      
      if (nodeData) {
        showContextMenu(e.clientX, e.clientY, nodeData);
      }
    }
  });
}

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
  fetchUndoRedoState();
});
