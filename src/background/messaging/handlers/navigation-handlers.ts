import type { Description, TabId } from '../../../shared/types/ids.js';
import { MSG, defineHandlers } from '../../../shared/types/messages.js';
import { tabManager } from '../../state/tab-manager.js';
import { treeStorage } from '../../services/tree-storage.js';
import { notifyTreeUpdate } from '../notifications.js';
import { ok, err } from '../../../shared/types/messages.js';
import { CommandManager } from '../../../shared/lib/commands.js';
import { NavigationTreeMapper } from '../../../shared/lib/mapper.js';
import { getActiveTab } from '../../tabs/lifecycle.js';
import { tempSelectionManager } from '../../services/temporary-selection.js';
import { syncOpenTabs } from '../../tabs/sync-open-tabs.js';

async function focusTab(tabId: TabId): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId !== undefined) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    await chrome.tabs.update(tabId, { active: true });
    return true;
  } catch (e) {
    return false;
  }
}

export const navigationHandlers = defineHandlers({
  async [MSG.NAVIGATE_TO](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err('Node not found');
    if (tabManager.openNodes().size === 0) {
      await syncOpenTabs();
    }

    const activeTab = await getActiveTab();
    const activeTabId = activeTab?.id as TabId | undefined;
    const activeNodeId = activeTabId ? tabManager.nodeByTab(activeTabId) : undefined;
    const shouldCycle = activeTabId !== undefined && activeNodeId === message.nodeId;

    if (shouldCycle) {
      const nextTabId = tabManager.getNextTabForNode(message.nodeId, activeTabId);
      if (nextTabId && nextTabId !== activeTabId) {
        tabManager.suppressNextTouch(nextTabId as TabId);
        const focused = await focusTab(nextTabId as TabId);
        if (focused) {
          tree.setCurrentById(message.nodeId);
          treeStorage.cacheTree(tree);
          await notifyTreeUpdate(tree, 'set-current', { focusNodeId: message.nodeId, mode: 'force' });
          return ok();
        }
        tabManager.unregister(nextTabId as TabId);
      }
    }

    const tabsArray = tabManager.getTabsByRecency(message.nodeId);
    for (const tabId of tabsArray) {
      const focused = await focusTab(tabId as TabId);
      if (focused) {
        tabManager.touch(tabId as TabId, message.nodeId);
        tree.setCurrentById(message.nodeId);
        treeStorage.cacheTree(tree);
        await notifyTreeUpdate(tree, 'set-current', { focusNodeId: message.nodeId, mode: 'force' });
        return ok();
      }
      tabManager.unregister(tabId as TabId);
    }

    const targetWindow = await chrome.windows.getLastFocused();
    const created = await chrome.tabs.create({
      windowId: targetWindow?.id,
      url: node.data.url,
      active: true,
    });

    if (created.id !== undefined) {
      const lastUsed = Number.isFinite(created.lastAccessed) ? created.lastAccessed : undefined;
      const registerOptions = lastUsed === undefined ? { touch: true } : { touch: true, lastUsed };
      tabManager.register(message.nodeId, created.id as TabId, registerOptions);
    }

    tree.setCurrentById(message.nodeId);
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, 'set-current', { focusNodeId: message.nodeId, mode: 'force' });

    CommandManager.saveSnapshot(NavigationTreeMapper.toJSON(tree), 'Navigate to' as Description);
    return ok();
  },

  async [MSG.PREVIEW_NODE](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err('Node not found');

    const tabsArray = tabManager.getTabsByRecency(message.nodeId);
    if (tabsArray.length === 0) {
      return ok();
    }
    for (const tabId of tabsArray) {
      tabManager.suppressNextActivate(tabId as TabId);
      const focused = await focusTab(tabId as TabId);
      if (focused) {
        return ok();
      }
      tabManager.unregister(tabId as TabId);
    }
    return ok();
  },

  async [MSG.BEGIN_TEMP_SELECTION](message) {
    try {
      const sessionId = await tempSelectionManager.begin(
        message.baseNodeId ?? null,
        message.options,
      );
      return ok({ sessionId });
    } catch (error) {
      return err(error instanceof Error ? error.message : 'Failed to begin temp selection');
    }
  },

  async [MSG.PREVIEW_TEMP_SELECTION](message) {
    try {
      const result = await tempSelectionManager.preview(
        message.sessionId,
        message.nodeId,
        message.tabId,
      );
      return ok(result);
    } catch (error) {
      return err(error instanceof Error ? error.message : 'Failed to preview temp selection');
    }
  },

  async [MSG.ACCEPT_TEMP_SELECTION](message) {
    try {
      await tempSelectionManager.accept(message.sessionId, message.nodeId);
      return ok();
    } catch (error) {
      return err(error instanceof Error ? error.message : 'Failed to accept temp selection');
    }
  },

  async [MSG.CANCEL_TEMP_SELECTION](message) {
    try {
      await tempSelectionManager.cancel(message.sessionId, { keepSession: message.keepSession } as { keepSession?: boolean });
      return ok();
    } catch (error) {
      return err(error instanceof Error ? error.message : 'Failed to cancel temp selection');
    }
  },

  async [MSG.END_TEMP_SELECTION](message) {
    tempSelectionManager.end(message.sessionId);
    return ok();
  },

  async [MSG.SET_CURRENT](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err('Node not found');

    tree.setCurrentById(message.nodeId);
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, 'set-current', { focusNodeId: message.nodeId, mode: 'force' });
    return ok();
  },

  async [MSG.OPEN_IN_NEW_TAB](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err('Node not found');

    const tab = await chrome.tabs.create({ url: node.data.url, active: false });
    if (tab.id !== undefined) {
      const lastUsed = Number.isFinite(tab.lastAccessed) ? tab.lastAccessed : undefined;
      const registerOptions = lastUsed === undefined ? { touch: false } : { touch: false, lastUsed };
      tabManager.register(message.nodeId, tab.id as TabId, registerOptions);
    }

    await notifyTreeUpdate(tree, 'tabs');
    return ok();
  },
});
