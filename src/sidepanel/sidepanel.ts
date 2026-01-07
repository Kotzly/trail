/**
 * Side Panel UI for Trail.
 * Displays the navigation tree for the current tab/window.
 * Supports both single-tab and multi-tab modes.
 */

// Import renderer to register it
import '../sidepanel/ui/graph/view/renderer';
import { getRenderer, TreeData } from '../sidepanel/ui/renderers/registry';
import { getGraphAPI } from '../sidepanel/ui/graph/state/graph-state';
import type { NodeId } from '../shared/types/ids';
import type { TreeNode } from '../shared/types/node';
import type { Settings } from '../shared/types/settings';
import { ThemeId } from './ui/shared/themes';
import { RequestMessage, ResponseMessage, NavigateToMessage, MSG, msg } from '../shared/types/messages';
import { TabState } from '../shared/types/tabs';

let settings: Settings | null = null;
let currentNodeId: NodeId | null = null; // Track which node is currently active
let previousNodeId: NodeId | null = null; // Track previous node for center animation
let openNodeIds = new Set<NodeId>(); // Nodes with open tabs (multi-tab mode)
let lastTreeData: TreeData | null = null; // Store tree data for search

// Search state
let searchResults: NodeId[] = []; // Array of matching node IDs
let searchIndex = 0; // Current focused result index
let searchQuery = ''; // Current search query

// Pinned dropdown state
let pinnedNodes: TreeNode[] = []; // Array of pinned nodes
let pinnedFocusIndex = -1; // Current focused index in dropdown
let pinnedDropdownOpen = false;


function applyTheme(theme: ThemeId): void {
  document.documentElement.setAttribute('data-theme', theme as string);
}

// Send message to service worker.
async function sendMessage(message: RequestMessage): Promise<ResponseMessage> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: ResponseMessage) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response.success) {
        resolve(response);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}

// Handle navigation to a node (used by renderers).
async function handleNodeNavigation(node: TreeNode): Promise<void> {
  try {
    const response = await sendMessage(msg.navigateTo({ url: node.url, nodeId: node.id }));
    if (!response.success) {
      console.error('sidepanel.handleNodeNavigation: Navigation failed:', response.error || 'unknown error');
      return;
    }
    updateCurrentSelection(node.id);
  } catch (error) {
    console.error('Navigation failed:', error);
  }
}

//  Update visual selection to show current node.
function updateCurrentSelection(nodeId: NodeId): void {
  currentNodeId = nodeId;
  const nodes = document.querySelectorAll('.tree-node');
  nodes.forEach(node => {
    const element = node as HTMLElement;
    const id = parseInt(element.dataset.nodeId || '0', 10) as NodeId;
    node.classList.toggle('current', id === nodeId);
  });
}

// Tab states (muted, audible) for nodes
let tabStates: Record<NodeId, TabState> = {};

// Render the navigation data using the current view mode.
function renderView(
  treeData: any,
  openNodes: NodeId[] | null = null,
  states: Record<NodeId, TabState> | null = null,
  nodeTabCounts: Record<NodeId, number> | null = null
): void {
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
  
  // Update count (always multi-tab mode)
  const openCount = openNodeIds.size;
  if (stackCount) {
    stackCount.textContent = `${nodeCount} page${nodeCount !== 1 ? 's' : ''} (${openCount} open)`;
  }
  
  if (!treeData?.root && !treeData?.roots) {
    // Graph view: just hide empty state and show empty canvas
    if (emptyState) emptyState.classList.add('hidden');
    if (stackList) stackList.innerHTML = '';
    
    // Render empty graph canvas
    const renderer = getRenderer(viewMode);
    if (renderer && stackList) {
      renderer({ roots: [], nodeCount: 0 }, stackList, {
        onNavigate: handleNodeNavigation,
        openNodeIds: openNodeIds,
        tabStates: tabStates || {},
      });
    }
    return;
  }
  
  if (emptyState) emptyState.classList.add('hidden');
  
  // Get the graph renderer
  const renderer = getRenderer(viewMode);
  
  if (!renderer || !stackList) {
    console.error(`No renderer found for view mode: ${viewMode}`);
    return;
  }
  
  // Render using graph view mode
  const newNodeId = renderer(treeData, stackList, {
    onNavigate: handleNodeNavigation,
        openNodeIds: openNodeIds,
        tabStates: tabStates || {},
        nodeTabCounts: nodeTabCounts || {}
  });
  
  // Check if current node changed (navigation happened)
  const nodeChanged = previousNodeId !== null && newNodeId !== null && newNodeId !== previousNodeId;
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
function scrollToCurrentNode(): void {
  const currentNode = document.querySelector('.tree-node.current, .stack-entry.current');
  if (currentNode) {
    currentNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Verify that tree.currentNodeId matches the active tab.
 * If not, update tree.currentNodeId to match active tab to prevent incorrect focus.
 */
async function verifyAndUpdateCurrentNode(treeData: any): Promise<void> {
  try {
    // Get current active tab
    const response = await sendMessage({ type: 'GET_CURRENT_TAB' }) as { tab?: chrome.tabs.Tab };
    if (!response.tab?.id) return;
    
    // Get nodeId for active tab
    const treeResponse = await sendMessage({ 
      type: 'GET_TREE', 
      tabId: response.tab.id 
    }) as { tree?: { currentNodeId?: NodeId | null } };
    
    // The response contains the correct currentNodeId for this tab
    // Update treeData to use the correct currentNodeId
    if (treeResponse.tree?.currentNodeId !== null && treeResponse.tree?.currentNodeId !== undefined && 
        treeResponse.tree?.currentNodeId !== treeData.currentNodeId) {
      treeData.currentNodeId = treeResponse.tree.currentNodeId;
    }
  } catch (error) {
    console.debug('Error verifying currentNode:', error);
  }
}

/**
 * Load and display tree for current tab/window.
 */
async function loadCurrentTab(): Promise<void> {
  try {
    // Get current tab
    const tabResponse = await sendMessage({ type: 'GET_CURRENT_TAB' }) as { tab?: chrome.tabs.Tab };
    
    if (!tabResponse.tab?.id) {
      console.error('No current tab found');
      return;
    }
    
    currentTabId = tabResponse.tab.id;
    currentWindowId = tabResponse.tab.windowId ?? null;
    
    // Load settings
    const settingsResponse = await sendMessage({ type: 'GET_SETTINGS' }) as { settings: Settings };
    settings = settingsResponse.settings;
    
    // Apply theme
    applyTheme(settings.theme);
    
    // Load tree (always per-window now)
    const response = await sendMessage({ type: 'GET_TREE', tabId: currentTabId }) as {
      tree: any;
      openNodeIds?: NodeId[];
      tabStates?: Record<NodeId, { muted?: boolean; audible?: boolean }>;
      nodeTabCounts?: Record<NodeId, number>;
    };
    
    // Always multi-tab mode
    isMultiTabMode = true;
    renderView(response.tree, response.openNodeIds || null, response.tabStates || null, response.nodeTabCounts || null);
  } catch (error) {
    console.error('Failed to load current tab:', error);
  }
}

/**
 * Initialize event listeners.
 */
function initEventListeners(): void {
  // Undo button
  const undoBtn = document.getElementById('undoBtn');
  if (undoBtn) {
    undoBtn.addEventListener('click', async () => {
    try {
      const response = await sendMessage({ type: 'UNDO' }) as { success: boolean; state?: any };
      if (response.success && response.state) {
        updateUndoRedoButtons(response.state);
      }
    } catch (error) {
      console.error('Failed to undo:', error);
    }
    });
  }
  
  // Redo button
  const redoBtn = document.getElementById('redoBtn');
  if (redoBtn) {
    redoBtn.addEventListener('click', async () => {
    try {
      const response = await sendMessage({ type: 'REDO' }) as { success: boolean; state?: any };
      if (response.success && response.state) {
        updateUndoRedoButtons(response.state);
      }
    } catch (error) {
      console.error('Failed to redo:', error);
    }
    });
  }
  
  // Keyboard shortcuts for undo/redo
  document.addEventListener('keydown', async (e: KeyboardEvent) => {
    // Check for Cmd/Ctrl+Z (undo) or Cmd/Ctrl+Shift+Z (redo)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      
      if (e.shiftKey) {
        // Redo
        try {
          const response = await sendMessage({ type: 'REDO' }) as { success: boolean; state?: any };
          if (response.success && response.state) {
            updateUndoRedoButtons(response.state);
          }
        } catch (error) {
          console.error('Failed to redo:', error);
        }
      } else {
        // Undo
        try {
          const response = await sendMessage({ type: 'UNDO' }) as { success: boolean; state?: any };
          if (response.success && response.state) {
            updateUndoRedoButtons(response.state);
          }
        } catch (error) {
          console.error('Failed to undo:', error);
        }
      }
    }
  });
  
  // Pinned dropdown button
  const pinnedBtn = document.getElementById('pinnedBtn');
  if (pinnedBtn) {
    pinnedBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      togglePinnedDropdown();
    });
  }
  
  // Close pinned dropdown when clicking outside
  document.addEventListener('click', (e: MouseEvent) => {
    const dropdown = document.getElementById('pinnedDropdown');
    const pinnedBtnEl = document.getElementById('pinnedBtn');
    const target = e.target as Node | null;
    if (pinnedDropdownOpen && dropdown && pinnedBtnEl && target && 
        !dropdown.contains(target) && !pinnedBtnEl.contains(target)) {
      closePinnedDropdown();
    }
  });
  
  // Keyboard navigation for pinned dropdown
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    handlePinnedDropdownKeydown(e);
  });
  
  // Clear button
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
    if (!currentTabId) return;
    
    try {
      await sendMessage({ type: 'CLEAR_TREE', tabId: currentTabId });
    } catch (error) {
      console.error('Failed to clear tree:', error);
    }
    });
  }
  
  // Settings button - toggle settings popover at click position
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e: MouseEvent) => {
      toggleSettingsPopover(e);
    });
  }
  
  // Close popover when clicking outside
  document.addEventListener('click', (e: MouseEvent) => {
    const popover = document.getElementById('settingsPopover');
    const settingsBtnEl = document.getElementById('settingsBtn');
    const target = e.target as Node | null;
    
    if (popover && settingsBtnEl && target &&
        !popover.classList.contains('hidden') && 
        !popover.contains(target) && 
        !settingsBtnEl.contains(target)) {
      popover.classList.add('hidden');
    }
  });
  
  // Collapsible category headers - expand first one by default
  document.querySelectorAll('.settings-category .category-header').forEach((header, index) => {
    // Expand first category by default
    if (index === 0) {
      const category = header.closest('.settings-category') as HTMLElement | null;
      if (category) {
        category.classList.add('expanded');
      }
    }
    
    header.addEventListener('click', () => {
      const category = header.closest('.settings-category') as HTMLElement | null;
      if (category) {
        category.classList.toggle('expanded');
      }
    });
  });
  
  // Theme icon clicks - save immediately
  document.querySelectorAll('#themeIcons .popover-icon-btn').forEach(btn => {
    const btnEl = btn as HTMLElement;
    btnEl.addEventListener('click', async () => {
      const theme = btnEl.dataset.theme;
      if (theme) {
        updateThemeIcons(theme);
        applyTheme(theme);
        await saveSettingsQuick({ theme: theme as Settings['theme'] });
      }
    });
  });

  

  // Selection Menu Instant toggle
  const selectionMenuToggle = document.getElementById('selectionMenuToggle') as HTMLInputElement | null;
  
  if (selectionMenuToggle) {
    selectionMenuToggle.addEventListener('change', async () => {
      const enabled = selectionMenuToggle.checked;
      await saveSettingsQuick({ selectionMenuInstant: enabled as false });
    });
  }
  
  // Feature flag toggles
  const enableSearchToggle = document.getElementById('enableSearchToggle') as HTMLInputElement | null;
  const enablePinNodesToggle = document.getElementById('enablePinNodesToggle') as HTMLInputElement | null;
  const enableTagsToggle = document.getElementById('enableTagsToggle') as HTMLInputElement | null;
  const pinSyncBrowserToggle = document.getElementById('pinSyncBrowserToggle') as HTMLInputElement | null;
  
  if (enableSearchToggle && enablePinNodesToggle && enableTagsToggle && pinSyncBrowserToggle) {
    enableSearchToggle.addEventListener('change', async () => {
      const enabled = enableSearchToggle.checked;
      await saveSettingsQuick({ enableSearch: enabled as true });
      updateFeatureUI(enabled, enablePinNodesToggle.checked, enableTagsToggle.checked, pinSyncBrowserToggle.checked);
    });
    
    enablePinNodesToggle.addEventListener('change', async () => {
      const enabled = enablePinNodesToggle.checked;
      await saveSettingsQuick({ enablePinNodes: enabled as true });
      // Show/hide pin sync option based on Pin Nodes toggle
      const pinSyncOption = document.getElementById('pinSyncOption');
      const pinSyncHint = document.getElementById('pinSyncHint');
      if (pinSyncOption) pinSyncOption.classList.toggle('hidden', !enabled);
      if (pinSyncHint) pinSyncHint.classList.toggle('hidden', !enabled);
    });
    
    // Pin sync with browser toggle
    pinSyncBrowserToggle.addEventListener('change', async () => {
      const enabled = pinSyncBrowserToggle.checked;
      await saveSettingsQuick({ pinSyncBrowser: enabled as false });
    });
    
    enableTagsToggle.addEventListener('change', async () => {
      const enabled = enableTagsToggle.checked;
      await saveSettingsQuick({ enableTags: enabled as true });
    });
  }
  
  // Search functionality
  const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
  const searchClear = document.getElementById('searchClear');
  const searchPrev = document.getElementById('searchPrev');
  const searchNext = document.getElementById('searchNext');
  
  let searchDebounce: ReturnType<typeof setTimeout> | null = null;
  
  if (searchInput) {
    searchInput.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        performSearch(target.value);
      }, 150);
    });
  }
  
  if (searchClear && searchInput) {
    searchClear.addEventListener('click', () => {
      clearSearch();
      searchInput.focus();
    });
  }
  
  if (searchPrev) {
    searchPrev.addEventListener('click', () => {
      focusSearchResult(searchIndex - 1);
    });
  }
  
  if (searchNext) {
    searchNext.addEventListener('click', () => {
      focusSearchResult(searchIndex + 1);
    });
  }
  
  // Keyboard shortcuts for search
  if (searchInput) {
    searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        const nodeId = searchResults[searchIndex];
        if (nodeId !== undefined) {
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
  }
  
  // Global Cmd/Ctrl+F to focus search
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      const searchBar = document.getElementById('searchBar');
      if (searchBar && !searchBar.classList.contains('hidden') && searchInput) {
        searchInput.focus();
        if (searchInput instanceof HTMLInputElement) {
          searchInput.select();
        }
      }
    }
  });
  
  // Listen for tree updates from service worker
  chrome.runtime.onMessage.addListener((message: any) => {
    if (message.type === 'TREE_UPDATED' && message.tabId === currentTabId) {
      renderView(message.tree);
      fetchUndoRedoState(); // Update undo/redo buttons
    } else if (message.type === 'GLOBAL_TREE_UPDATED') {
      // Global tree update - all sidepanels receive this
      // Before rendering, verify currentNodeId matches active tab
      // This prevents focus switching when programmatic tabs are created
      verifyAndUpdateCurrentNode(message.tree).then(() => {
        renderView(
          message.tree,
          message.openNodeIds || null,
          message.tabStates || null,
          message.nodeTabCounts || null
        );
        fetchUndoRedoState(); // Update undo/redo buttons
      });
    } else if (message.type === 'WINDOW_TREE_UPDATED' && message.windowId === currentWindowId) {
      // Legacy per-window tree update (single-tab mode)
      renderView(message.tree, message.openNodeIds || null, message.tabStates || null);
      fetchUndoRedoState(); // Update undo/redo buttons
    }
  });
  
  // Listen for tab activation changes
  chrome.tabs.onActivated.addListener(async (activeInfo: { tabId: number; windowId: number }) => {
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
  chrome.windows.onFocusChanged.addListener(async (windowId: number) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    
    try {
      // Get active tab in the focused window
      const tabs = await chrome.tabs.query({ windowId, active: true });
      if (tabs.length > 0 && tabs[0]?.id !== undefined && tabs[0].id !== currentTabId) {
        currentTabId = tabs[0].id;
        currentWindowId = tabs[0]?.windowId ?? null;
        loadCurrentTab();
      }
    } catch (error) {
      console.debug('Window focus change error:', error);
    }
  });
  
  // Listen for storage changes (settings updates from other places)
  chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === 'sync' && changes.settings) {
      settings = changes.settings.newValue as Settings;
      
      // Apply theme
      if (settings) {
        applyTheme(settings.theme);
        
        // Re-render tree
        if (currentTabId) {
          sendMessage({ type: 'GET_TREE', tabId: currentTabId })
            .then((response: any) => renderView(response.tree))
            .catch(console.error);
        }
      }
    }
  });
}

/**
 * Toggle settings popover at button position.
 */
function toggleSettingsPopover(e: MouseEvent): void {
  const popover = document.getElementById('settingsPopover');
  const btn = document.getElementById('settingsBtn');
  
  if (!popover || !btn) return;
  
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
  updateMultiTabUI(settings?.multiTabLimit ?? 0, Boolean(settings?.showOrphanTrees ?? true));
  updateNavigationUI(Boolean(settings?.compactGraph ?? false), Boolean(settings?.selectionMenuInstant ?? false));
  updateFeatureUI(
    Boolean(settings?.enableSearch ?? true),
    Boolean(settings?.enablePinNodes ?? true),
    Boolean(settings?.enableTags ?? true),
    Boolean(settings?.pinSyncBrowser ?? false)
  );
  
  popover.classList.remove('hidden');
}

/**
 * Update theme icons active state.
 */
function updateThemeIcons(theme: string): void {
  document.querySelectorAll('#themeIcons .popover-icon-btn').forEach(btn => {
    const btnEl = btn as HTMLElement;
    btnEl.classList.toggle('active', btnEl.dataset.theme === theme);
  });
}

/**
 * Update Multi-Tab UI state.
 */
function updateMultiTabUI(limit: number, showOrphanTrees: boolean): void {
  const limitInput = document.getElementById('multiTabLimit') as HTMLInputElement | null;
  const showOrphanTreesToggle = document.getElementById('showOrphanTreesToggle') as HTMLInputElement | null;
  
  if (limitInput) limitInput.value = String(limit);
  if (showOrphanTreesToggle) showOrphanTreesToggle.checked = showOrphanTrees;
}

/**
 * Update navigation UI state.
 */
function updateNavigationUI(compactGraph: boolean, selectionMenuInstant: boolean): void {
  const compactGraphToggle = document.getElementById('compactGraphToggle') as HTMLInputElement | null;
  const selectionMenuToggle = document.getElementById('selectionMenuToggle') as HTMLInputElement | null;
  
  // Set toggle states
  if (compactGraphToggle) compactGraphToggle.checked = compactGraph === true;
  if (selectionMenuToggle) selectionMenuToggle.checked = selectionMenuInstant === true;
}

/**
 * Update undo/redo button states.
 */
function updateUndoRedoButtons(state: { canUndo: boolean; canRedo: boolean; undoDescription?: string; redoDescription?: string }): void {
  const undoBtn = document.getElementById('undoBtn') as HTMLButtonElement | null;
  const redoBtn = document.getElementById('redoBtn') as HTMLButtonElement | null;
  
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
async function fetchUndoRedoState(): Promise<void> {
  try {
    const response = await sendMessage({ type: 'GET_UNDO_STATE' }) as { success: boolean; state?: any };
    if (response.success && response.state) {
      updateUndoRedoButtons(response.state);
    }
  } catch (error) {
    // Undo state not available
  }
}

/**
 * Update feature flags UI and show/hide related UI elements.
 */
function updateFeatureUI(enableSearch: boolean, enablePinNodes: boolean, enableTags: boolean, pinSyncBrowser: boolean): void {
  const enableSearchToggle = document.getElementById('enableSearchToggle') as HTMLInputElement | null;
  const enablePinNodesToggle = document.getElementById('enablePinNodesToggle') as HTMLInputElement | null;
  const enableTagsToggle = document.getElementById('enableTagsToggle') as HTMLInputElement | null;
  const pinSyncBrowserToggle = document.getElementById('pinSyncBrowserToggle') as HTMLInputElement | null;
  const searchBar = document.getElementById('searchBar');
  const pinSyncOption = document.getElementById('pinSyncOption');
  const pinSyncHint = document.getElementById('pinSyncHint');
  
  // Set toggle states
  if (enableSearchToggle) enableSearchToggle.checked = Boolean(enableSearch);
  if (enablePinNodesToggle) enablePinNodesToggle.checked = Boolean(enablePinNodes);
  if (enableTagsToggle) enableTagsToggle.checked = Boolean(enableTags);
  if (pinSyncBrowserToggle) pinSyncBrowserToggle.checked = Boolean(pinSyncBrowser);
  
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
 */
function searchNodes(query: string, treeData: any): NodeId[] {
  if (!query || !treeData) return [];
  
  const q = query.toLowerCase().trim();
  if (!q) return [];
  
  const matches: NodeId[] = [];
  
  // Recursive search through tree
  function searchNode(node: TreeNode | null): void {
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
  const roots: TreeNode[] = treeData.roots || (treeData.root ? [treeData.root] : []);
  roots.forEach(root => searchNode(root));
  
  return matches;
}

/**
 * Perform search and update UI.
 */
function performSearch(query: string): void {
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
function updateSearchUI(): void {
  const searchResultsEl = document.getElementById('searchResults');
  const searchCountEl = document.getElementById('searchCount');
  const searchClearEl = document.getElementById('searchClear');
  
  if (searchQuery) {
    if (searchResultsEl) searchResultsEl.classList.remove('hidden');
    if (searchClearEl) searchClearEl.classList.remove('hidden');
    
    if (searchResults.length === 0) {
      if (searchCountEl) searchCountEl.textContent = 'No results';
    } else {
      if (searchCountEl) searchCountEl.textContent = `${searchIndex + 1} of ${searchResults.length}`;
    }
  } else {
    if (searchResultsEl) searchResultsEl.classList.add('hidden');
    if (searchClearEl) searchClearEl.classList.add('hidden');
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
 */
function focusSearchResult(index: number): void {
  if (searchResults.length === 0) return;
  
  searchIndex = ((index % searchResults.length) + searchResults.length) % searchResults.length;
  const nodeId = searchResults[searchIndex];
  if (!nodeId) return;
  
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
function clearSearch(): void {
  searchQuery = '';
  searchResults = [];
  searchIndex = 0;
  
  const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
  if (searchInput) searchInput.value = '';
  
  updateSearchUI();
  applySearchHighlights();
}

// ========================================
// PINNED DROPDOWN FUNCTIONALITY
// ========================================

/**
 * Collect all pinned nodes from tree data.
 */
function collectPinnedNodes(treeData: any): TreeNode[] {
  if (!treeData) return [];
  
  const pinned: TreeNode[] = [];
  
  function traverse(node: TreeNode | null): void {
    if (!node) return;
    if (node.pinned) {
      pinned.push(node);
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  
  const roots: TreeNode[] = treeData.roots || (treeData.root ? [treeData.root] : []);
  roots.forEach(traverse);
  
  return pinned;
}

/**
 * Open pinned dropdown and populate with pinned nodes.
 */
function openPinnedDropdown(): void {
  const dropdown = document.getElementById('pinnedDropdown');
  const list = document.getElementById('pinnedList');
  const count = document.getElementById('pinnedCount');
  
  if (!dropdown || !list || !count) return;
  
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
      const itemEl = item as HTMLElement;
      itemEl.addEventListener('click', () => {
        const nodeId = parseInt(itemEl.dataset.nodeId || '0', 10) as NodeId;
        const node = pinnedNodes.find(n => n.id === nodeId);
        if (node) {
          handleNodeNavigation(node);
          closePinnedDropdown();
        }
      });
      itemEl.addEventListener('mouseenter', () => {
        updatePinnedFocus(idx);
      });
    });
  }
  
  dropdown.classList.remove('hidden');
}

/**
 * Close pinned dropdown.
 */
function closePinnedDropdown(): void {
  const dropdown = document.getElementById('pinnedDropdown');
  if (dropdown) {
    dropdown.classList.add('hidden');
  }
  pinnedDropdownOpen = false;
  pinnedFocusIndex = -1;
}

/**
 * Toggle pinned dropdown.
 */
function togglePinnedDropdown(): void {
  if (pinnedDropdownOpen) {
    closePinnedDropdown();
  } else {
    openPinnedDropdown();
  }
}

/**
 * Update focus in pinned dropdown.
 */
function updatePinnedFocus(newIndex: number): void {
  if (pinnedNodes.length === 0) return;
  
  // Wrap around
  pinnedFocusIndex = ((newIndex % pinnedNodes.length) + pinnedNodes.length) % pinnedNodes.length;
  
  // Update visual focus
  const items = document.querySelectorAll('.pinned-dropdown-item');
  items.forEach((item, idx) => {
    item.classList.toggle('focused', idx === pinnedFocusIndex);
  });
  
  // Scroll into view
  const focusedItem = items[pinnedFocusIndex];
  if (focusedItem) {
    focusedItem.scrollIntoView({ block: 'nearest' });
  }
}

/**
 * Handle keyboard navigation in pinned dropdown.
 */
function handlePinnedDropdownKeydown(e: KeyboardEvent): void {
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
        if (node) {
          handleNodeNavigation(node);
          closePinnedDropdown();
        }
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
 */
function findNodeById(treeData: any, nodeId: NodeId): TreeNode | null {
  if (!treeData) return null;
  
  function search(node: TreeNode | null): TreeNode | null {
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
  
  const roots: TreeNode[] = treeData.roots || (treeData.root ? [treeData.root] : []);
  for (const root of roots) {
    const found = search(root);
    if (found) return found;
  }
  return null;
}

/**
 * Save settings quickly (for popover - immediate save).
 */
async function saveSettingsQuick(updates: Partial<Settings>): Promise<void> {
  if (!settings) return;
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

let contextMenuNode: TreeNode | null = null; // Node that was right-clicked
let contextMenuTabInfo: chrome.tabs.Tab | null = null; // Tab info for the node (multi-tab mode)

/**
 * Show context menu at position.
 */
async function showContextMenu(x: number, y: number, node: TreeNode): Promise<void> {
  const menu = document.getElementById('contextMenu');
  if (!menu) return;
  
  contextMenuNode = node;
  
  // Get tab info if in multi-tab mode
  contextMenuTabInfo = null;
  // Always multi-tab mode
  try {
    const response = await sendMessage({ 
      type: 'GET_TAB_FOR_NODE', 
      windowId: currentWindowId, 
      nodeId: node.id 
    }) as { tabInfo?: chrome.tabs.Tab | null };
    contextMenuTabInfo = response.tabInfo || null;
  } catch (e) {
    // Tab might not exist
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
function hideContextMenu(): void {
  const menu = document.getElementById('contextMenu');
  if (menu) {
    menu.classList.add('hidden');
  }
  contextMenuNode = null;
  contextMenuTabInfo = null;
}

/**
 * Update context menu items based on current state.
 */
function updateContextMenuItems(): void {
  const isMultiTab = true; // Always multi-tab mode
  const hasOpenTab = contextMenuTabInfo !== null;
  
  // Show/hide multi-tab only items
  document.querySelectorAll('.context-menu-item.multi-tab-only').forEach(item => {
    item.classList.toggle('hidden-item', !isMultiTab);
  });
  
  // Update mute label
  if (contextMenuTabInfo) {
    const muteLabel = document.querySelector('.mute-label');
    if (muteLabel) {
      muteLabel.textContent = contextMenuTabInfo.mutedInfo?.muted ? 'Unmute Tab' : 'Mute Tab';
    }
    
    const pinLabel = document.querySelector('.pin-label');
    if (pinLabel) {
      pinLabel.textContent = contextMenuTabInfo.pinned ? 'Unpin Tab' : 'Pin Tab';
    }
  }
  
  // Disable tab actions if tab is not open
  document.querySelectorAll('[data-action="muteTab"], [data-action="pinTab"], [data-action="duplicateTab"], [data-action="closeTab"]').forEach(item => {
    item.classList.toggle('disabled', !hasOpenTab);
  });
}

/**
 * Handle context menu action.
 */
async function handleContextMenuAction(action: string): Promise<void> {
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
        if (tabInfo && tabInfo.id !== undefined) {
          await chrome.tabs.update(tabInfo.id, { muted: !tabInfo.mutedInfo?.muted });
        }
        break;
        
      case 'pinTab':
        if (tabInfo && tabInfo.id !== undefined) {
          await chrome.tabs.update(tabInfo.id, { pinned: !tabInfo.pinned });
        }
        break;
        
      case 'duplicateTab':
        if (tabInfo && tabInfo.id !== undefined) {
          await chrome.tabs.duplicate(tabInfo.id);
        }
        break;
        
      case 'closeTab':
        if (tabInfo && tabInfo.id !== undefined) {
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
function initContextMenu(): void {
  const menu = document.getElementById('contextMenu');
  if (!menu) return;
  
  // Handle menu item clicks
  menu.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const item = target.closest('.context-menu-item') as HTMLElement | null;
    if (item && !item.classList.contains('disabled') && item.dataset.action) {
      handleContextMenuAction(item.dataset.action);
    }
  });
  
  // Hide menu on click outside
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as Node | null;
    if (target && !menu.contains(target)) {
      hideContextMenu();
    }
  });
  
  // Hide menu on scroll
  const stackContainer = document.getElementById('stackContainer');
  if (stackContainer) {
    stackContainer.addEventListener('scroll', hideContextMenu);
  }
  
  // Listen for contextmenu on nodes (delegated)
  const stackList = document.getElementById('stackList');
  if (stackList) {
    stackList.addEventListener('contextmenu', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const nodeEl = target.closest('.tree-node, .stack-entry, .graph-node') as HTMLElement | null;
      if (nodeEl) {
        e.preventDefault();
        
        // Find node data from the tree
        const nodeId = parseInt(nodeEl.dataset.nodeId || '0', 10) as NodeId;
        const nodeData = findNodeById(lastTreeData, nodeId);
        
        if (nodeData) {
          showContextMenu(e.clientX, e.clientY, nodeData);
        }
      }
    });
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  // CRITICAL: Get window ID BEFORE adding message listeners
  // This ensures we know which window we're in before any messages arrive
  try {
    const window = await chrome.windows.getCurrent();
    currentWindowId = window.id ?? null;
  } catch (error) {
    console.error('Failed to get current window:', error);
  }

  initEventListeners();
  initContextMenu();
  loadCurrentTab();
  fetchUndoRedoState();
});
