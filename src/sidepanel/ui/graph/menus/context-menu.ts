import type { NodeId, Tag } from '../../../../shared/types/ids';
import type { TreeNode } from '../../../../background/state/tree-node';
import { TAG_PRESETS } from '../tags';
import { GraphState } from '../state/graph-state';

/**
 * Remove active context menu if exists.
 */
export function removeContextMenu(): void {
  const activeMenu = GraphState.getActiveContextMenu();
  if (activeMenu) {
    activeMenu.remove();
    GraphState.setActiveContextMenu(null);
  }
}

/**
 * Create and show context menu for a node.
 */
export function showContextMenu(e: MouseEvent, node: TreeNode): void {
  e.preventDefault();
  removeContextMenu();
  
  const menu = document.createElement('div');
  menu.className = 'graph-context-menu';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  
  const currentTabStates = GraphState.getCurrentTabStates();
  const currentOnNavigate = GraphState.getCurrentOnNavigate();
  
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
  if (hasOpenTab && tabState) {
    // Divider before tab actions
    const tabDivider = document.createElement('div');
    tabDivider.className = 'graph-context-menu-divider';
    menu.appendChild(tabDivider);
    
    // Mute/Unmute tab
    const muteItem = document.createElement('div');
    muteItem.className = 'graph-context-menu-item';
    muteItem.innerHTML = tabState.sound.muted 
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
    const hasTag = node.tags && node.tags.includes(tag.label as Tag);
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
  
  // Delete options
  const hasChildren = node.children && node.children.length > 0;
  const isRoot = (node as any).isRoot !== false; // Check if node is root (legacy property)
  
  // Always show delete options (with a divider)
  const deleteDivider = document.createElement('div');
  deleteDivider.className = 'graph-context-menu-divider';
  menu.appendChild(deleteDivider);
  
  if (!isRoot) {
    // Non-root nodes: show all delete options
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
    if (hasChildren) {
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
  } else {
    // Root nodes
    if (hasChildren) {
      // Root with children: show "Delete children" and "Delete with children"
      const deleteChildren = document.createElement('div');
      deleteChildren.className = 'graph-context-menu-item danger';
      deleteChildren.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Delete children';
      deleteChildren.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'DELETE_CHILDREN', nodeId: node.id });
        removeContextMenu();
      });
      menu.appendChild(deleteChildren);
      
      const deleteWithChildren = document.createElement('div');
      deleteWithChildren.className = 'graph-context-menu-item danger';
      deleteWithChildren.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Delete with children';
      deleteWithChildren.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'DELETE_WITH_CHILDREN', nodeId: node.id });
        removeContextMenu();
      });
      menu.appendChild(deleteWithChildren);
    } else {
      // Root without children: show "Delete tree"
      const deleteTree = document.createElement('div');
      deleteTree.className = 'graph-context-menu-item danger';
      deleteTree.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg> Delete tree';
      deleteTree.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'DELETE_WITH_CHILDREN', nodeId: node.id });
        removeContextMenu();
      });
      menu.appendChild(deleteTree);
    }
  }
  
  document.body.appendChild(menu);
  GraphState.setActiveContextMenu(menu);
  
  // Adjust position if menu goes off-screen
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - menuRect.height - 8}px`;
  }
  
  // Close on click outside
  const closeHandler = (ev: MouseEvent) => {
    const target = ev.target as Node | null;
    if (target && !menu.contains(target)) {
      removeContextMenu();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

/**
 * Show bulk context menu for multiple selected nodes.
 */
export function showBulkContextMenu(e: MouseEvent, nodeIds: Set<NodeId>): void {
  e.preventDefault();
  removeContextMenu();
  
  // Copy the nodeIds at menu open time (the Set could be mutated later)
  const nodeIdsCopy = Array.from(nodeIds);
  const selectedNodeIds = GraphState.getSelectedNodeIds();
  
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
    GraphState.setSelectedNodeIds(new Set());
    removeContextMenu();
  });
  menu.appendChild(pinSelected);
  
  // Unpin selected
  const unpinSelected = document.createElement('div');
  unpinSelected.className = 'graph-context-menu-item';
  unpinSelected.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg> Unpin selected';
  unpinSelected.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'BULK_UNPIN', nodeIds: nodeIdsCopy });
    GraphState.setSelectedNodeIds(new Set());
    removeContextMenu();
  });
  menu.appendChild(unpinSelected);
  
  // Close selected tabs
  const closeTabs = document.createElement('div');
  closeTabs.className = 'graph-context-menu-item';
  closeTabs.innerHTML = '<svg class="menu-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close selected tabs';
  closeTabs.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'BULK_CLOSE_TABS', nodeIds: nodeIdsCopy });
    GraphState.setSelectedNodeIds(new Set());
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
    GraphState.setSelectedNodeIds(new Set());
    removeContextMenu();
  });
  menu.appendChild(deleteSelected);
  
  document.body.appendChild(menu);
  GraphState.setActiveContextMenu(menu);
  
  // Adjust position
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - menuRect.height - 8}px`;
  }
  
  // Close on click outside
  const closeHandler = (ev: MouseEvent) => {
    const target = ev.target as Node | null;
    if (target && !menu.contains(target)) {
      removeContextMenu();
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

