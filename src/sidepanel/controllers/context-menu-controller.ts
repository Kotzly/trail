import type { TreeNode } from "../../background/state/treenode";
import { PanelState } from "../state/panel-state";
import { getTabsForNode } from "../api/tabs";
import { navigateTo } from "../api/tree";
import { NodeId } from "../../shared/types/ids";

// Show context menu at position.
export async function showContextMenu(x: number, y: number, node: TreeNode): Promise<void> {
    const menu = document.getElementById('contextMenu');
    if (!menu) return;
    
    PanelState.contextMenu.node = node;
    
    const tabs = await getTabsForNode(node.id);
    PanelState.contextMenu.tabs = tabs;
    
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
  
  // Hide context menu.
  function hideContextMenu(): void {
    const menu = document.getElementById('contextMenu');
    if (menu) {
      menu.classList.add('hidden');
    }
    PanelState.contextMenu.node = null;
    PanelState.contextMenu.tabs = [];
  }
  
  // Update context menu items based on current state.
  function updateContextMenuItems(): void {
    const hasOpenTab = PanelState.contextMenu.tabs.length > 0;
    const node = PanelState.contextMenu.node;
    const hasTitle = node && node.title && node.title.trim() !== '';
    
    // todo: optimize to show mute label for all tabs in the node, not just the first one

    // Update mute label
    if (hasOpenTab) {
      const muteLabel = document.querySelector('.mute-label');
      if (muteLabel) {
        muteLabel.textContent = PanelState.contextMenu.tabs[0]!.mutedInfo?.muted ? 'Unmute Tab' : 'Mute Tab';
      }
      
      const pinLabel = document.querySelector('.pin-label');
      if (pinLabel) {
        pinLabel.textContent = PanelState.contextMenu.tabs[0]!.pinned ? 'Unpin Tab' : 'Pin Tab';
      }
    }
    
    // Disable tab actions if tab is not open
    document.querySelectorAll('[data-action="muteTab"], [data-action="pinTab"], [data-action="duplicateTab"], [data-action="closeTab"]').forEach(item => {
      item.classList.toggle('disabled', !hasOpenTab);
    });

    // todo: check this works correctly
    const copyTitleItem = document.querySelector('[data-action="copyTitle"]') as HTMLElement | null;
    if (copyTitleItem) {
      copyTitleItem.style.display = hasTitle ? '' : 'none';
    }
  }
  
  // Handle context menu action.
  async function handleContextMenuAction(action: string): Promise<void> {
    if (!PanelState.contextMenu.node) return;
    
    const node = PanelState.contextMenu.node;
    const tabInfo = (Array.isArray(PanelState.contextMenu.tabs) && PanelState.contextMenu.tabs.length > 0)
      ? PanelState.contextMenu.tabs[0]
      : undefined; // todo: it probably does not correlate with the selected tab.
      // make it so that the selected tabs are calculated at hover or at the RMB press
    
    try {
      switch (action) {
        case 'open':
          await navigateTo(node);
          hideContextMenu();
          break;
          
        case 'openNewTab':
          await chrome.tabs.create({ url: node.url, active: false });
          // hideContextMenu() // we dont use it here as this ^ is false
          break;
          
        case 'openNewWindow':
          await chrome.windows.create({ url: node.url });
          hideContextMenu()
          break;
          
        case 'copyUrl':
          await navigator.clipboard.writeText(node.url);
          // dont hide context menu here
          break;
          
        case 'copyTitle': 
          await navigator.clipboard.writeText(node.title || 'Untitled');
          // dont hide context menu
          break;
          
        case 'muteTab': // todo: multi tab node choose
          if (tabInfo && tabInfo.id !== undefined) {
            await chrome.tabs.update(tabInfo.id, { muted: !tabInfo.mutedInfo?.muted });
          }
          break;
          
        case 'pinTab': // todo: multi tab node choose
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
          hideContextMenu()
          break;
          
        case 'removeFromHistory':
          // todo: implement. no-op for now.
          console.log('removeFromHistory not implemented');
          break;
      }
    } catch (error) {
      console.error(`Context menu action "${action}" failed:`, error);
    }
  }
  
  // Initialize context menu listeners.
export function initContextMenu(): void {
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
    
    // Listen for contextmenu on nodes
    // viewContent is the new stackList.
    // todo: rename all stackList -> viewContent,
    // todo: rename all stackContainer -> viewContainer
    // and make all the code use viewContent and viewContainer instead of stackList and stackContainer
    const viewContent = document.getElementById('viewContent');
    if (viewContent) {
      viewContent.addEventListener('contextmenu', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const nodeEl = target.closest('.graph-node') as HTMLElement | null;
        if (nodeEl) {
          e.preventDefault();
          
          // Find node data from the tree
          const nodeId = parseInt(nodeEl.dataset.nodeId || '0', 10) as NodeId;
          const nodeData = PanelState.tree?.findNodeByIdDFS(nodeId) ?? null;
          
          if (nodeData) {
            showContextMenu(e.clientX, e.clientY, nodeData);
          }
        }
      });
    }
  }
  
  