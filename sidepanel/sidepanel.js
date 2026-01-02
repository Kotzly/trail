/**
 * Side Panel UI for Stack History.
 * Displays the navigation tree for the current tab.
 */

let currentTabId = null;
let settings = null;
let currentNodeId = null; // Track which node is currently active

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
 * Format timestamp to relative time.
 * @param {number} timestamp
 * @returns {string}
 */
function formatTime(timestamp) {
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
function formatUrl(url) {
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
 * Create favicon element with fallback.
 * @param {string} faviconUrl
 * @returns {HTMLElement}
 */
function createFaviconElement(faviconUrl) {
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

/**
 * Create tree node element.
 * Uses <a> tag so browser shows URL in status bar on hover.
 * @param {object} node - Tree node data
 * @param {number} indent - Visual indent level (unused now, kept for compatibility)
 * @param {number} currentId - ID of current node
 * @returns {HTMLElement}
 */
function createTreeNode(node, indent, currentId) {
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
  
  // Click handler - navigate via extension API
  anchor.addEventListener('click', async (event) => {
    event.preventDefault();
    
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
  });
  
  wrapper.appendChild(anchor);
  
  return wrapper;
}

// Removed - not needed for tree view

/**
 * Update visual selection to show current node.
 * @param {number} nodeId - ID of the current node
 */
function updateCurrentSelection(nodeId) {
  currentNodeId = nodeId;
  const nodes = document.querySelectorAll('.tree-node');
  nodes.forEach(node => {
    const id = parseInt(node.dataset.nodeId, 10);
    node.classList.toggle('current', id === nodeId);
  });
}

/**
 * Escape HTML to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Render a branch (a node and all its descendants) into a container.
 */
function renderBranch(node, container, indent, currentId, isFirstBranch, isLastBranch) {
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
  renderLinearChain(node, branchContainer, currentId);
  
  container.appendChild(branchContainer);
}

/**
 * Render a node and its linear chain of single children.
 * When a fork is encountered, render each branch separately.
 */
function renderLinearChain(node, container, currentId) {
  if (!node) return;
  
  // Create node element
  const nodeEl = createTreeNode(node, 0, currentId, false, false, false);
  container.appendChild(nodeEl);
  
  // Check children
  if (!node.children || node.children.length === 0) {
    return; // Leaf node
  }
  
  if (node.children.length === 1) {
    // Single child - continue linear chain
    renderLinearChain(node.children[0], container, currentId);
  } else {
    // Fork! Create a fork container for all branches
    const forkContainer = document.createElement('div');
    forkContainer.className = 'fork-container';
    
    node.children.forEach((child, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === node.children.length - 1;
      renderBranch(child, forkContainer, 1, currentId, isFirst, isLast);
    });
    
    container.appendChild(forkContainer);
  }
}

/**
 * Render the tree in the UI.
 * @param {object} treeData - Serialized tree data
 */
function renderTree(treeData) {
  const stackList = document.getElementById('stackList');
  const emptyState = document.getElementById('emptyState');
  const stackCount = document.getElementById('stackCount');
  
  const root = treeData?.root;
  const treeCurrentId = treeData?.currentNodeId;
  const nodeCount = treeData?.nodeCount || 0;
  
  // Update count
  stackCount.textContent = `${nodeCount} page${nodeCount !== 1 ? 's' : ''}`;
  
  // Show/hide empty state
  if (!root) {
    emptyState.classList.remove('hidden');
    stackList.innerHTML = '';
    return;
  }
  
  emptyState.classList.add('hidden');
  
  // Clear and rebuild list
  stackList.innerHTML = '';
  
  // Render tree starting from root
  renderBranch(root, stackList, 0, treeCurrentId, true, true);
  
  // Store current node ID
  currentNodeId = treeCurrentId;
  
  // Scroll to current node
  scrollToCurrentNode();
}

/**
 * Scroll the container to show the current node.
 */
function scrollToCurrentNode() {
  const currentNode = document.querySelector('.tree-node.current');
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
    
    // Load tree for this tab
    const { tree } = await sendMessage({ type: 'GET_TREE', tabId: currentTabId });
    renderTree(tree);
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
  
  // Settings button - open options page
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  // Listen for tree updates from service worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TREE_UPDATED' && message.tabId === currentTabId) {
      renderTree(message.tree);
    }
  });
  
  // Listen for tab activation changes
  chrome.tabs.onActivated.addListener((activeInfo) => {
    if (activeInfo.tabId !== currentTabId) {
      currentTabId = activeInfo.tabId;
      loadCurrentTab();
    }
  });
  
  // Listen for storage changes (settings updates)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.settings) {
      settings = changes.settings.newValue;
      // Re-render tree
      if (currentTabId) {
        sendMessage({ type: 'GET_TREE', tabId: currentTabId })
          .then(({ tree }) => renderTree(tree))
          .catch(console.error);
      }
    }
  });
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadCurrentTab();
});
