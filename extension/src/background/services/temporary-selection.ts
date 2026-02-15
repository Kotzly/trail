import type { NodeId, TabId, Url } from '../../shared/types/ids.js';
import type { TempSelectionOptions } from '../../shared/rpc/contracts.js';
import { tabManager } from '../state/tab-manager.js';
import { treeStorage } from './tree-storage.js';
import { notifyTreeUpdate } from '../messaging/notifications.js';

type SessionId = string;

type TempSelectionState = {
  id: SessionId;
  baseNodeId: NodeId | null;
  baseTabId: TabId | null;
  previewNodeId: NodeId | null;
  previewTabId: TabId | null;
  options: Required<TempSelectionOptions>;
};

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const active = await chrome.tabs.query({ active: true, currentWindow: true });
  return active[0];
}

async function focusTab(tabId: TabId): Promise<boolean> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId !== undefined) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    await chrome.tabs.update(tabId, { active: true });
    return true;
  } catch {
    return false;
  }
}

const defaultOptions: Required<TempSelectionOptions> = {
  allowCreateOnCommit: true,
  allowPreviewWithoutTabs: true,
};

export class TemporaryTabSelectionManager {
  private sessions = new Map<SessionId, TempSelectionState>();
  private activeSessionId: SessionId | null = null;
  private counter = 0;

  private makeSessionId(): SessionId {
    this.counter += 1;
    return `temp-${Date.now()}-${this.counter}`;
  }

  async begin(baseNodeId?: NodeId | null, options?: TempSelectionOptions): Promise<SessionId> {
    if (this.activeSessionId) {
      this.end(this.activeSessionId);
    }

    const activeTab = await getActiveTab();
    const activeTabId = activeTab?.id as TabId | undefined;
    const fallbackBase = activeTabId ? tabManager.nodeByTab(activeTabId) ?? null : null;

    const sessionId = this.makeSessionId();
    const session: TempSelectionState = {
      id: sessionId,
      baseNodeId: baseNodeId ?? fallbackBase ?? null,
      baseTabId: activeTabId ?? null,
      previewNodeId: null,
      previewTabId: null,
      options: { ...defaultOptions, ...options },
    };

    this.sessions.set(sessionId, session);
    this.activeSessionId = sessionId;
    return sessionId;
  }

  async preview(sessionId: SessionId, nodeId: NodeId, tabId?: TabId): Promise<{ previewedTabId: TabId | null }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Temp selection session not found');
    session.previewNodeId = nodeId;

    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(nodeId);
    if (!node) throw new Error('Node not found');

    if (tabId !== undefined) {
      const resolvedNode = tabManager.nodeByTab(tabId as TabId);
      if (resolvedNode === nodeId) {
        tabManager.suppressNextActivate(tabId as TabId, sessionId);
        const focused = await focusTab(tabId as TabId);
        if (focused) {
          session.previewTabId = tabId as TabId;
          return { previewedTabId: tabId as TabId };
        }
        tabManager.clearSuppressActivate(tabId as TabId);
        tabManager.unregister(tabId as TabId);
      }
    }

    const tabsArray = tabManager.getTabsByRecency(nodeId);
    if (tabsArray.length === 0) {
      session.previewTabId = null;
      if (!session.options.allowPreviewWithoutTabs) {
        throw new Error('No open tabs to preview');
      }
      return { previewedTabId: null };
    }

    for (const tabId of tabsArray) {
      tabManager.suppressNextActivate(tabId as TabId, sessionId);
      const focused = await focusTab(tabId as TabId);
      if (focused) {
        session.previewTabId = tabId as TabId;
        return { previewedTabId: tabId as TabId };
      }
      tabManager.clearSuppressActivate(tabId as TabId);
      tabManager.unregister(tabId as TabId);
    }

    session.previewTabId = null;
    return { previewedTabId: null };
  }

  async accept(sessionId: SessionId, nodeId?: NodeId): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Temp selection session not found');
    const resolvedNodeId = nodeId ?? session.previewNodeId;
    if (!resolvedNodeId) {
      this.end(sessionId);
      return;
    }

    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(resolvedNodeId);
    if (!node) throw new Error('Node not found');

    const previewTabId = session.previewTabId;
    if (previewTabId && tabManager.nodeByTab(previewTabId) === resolvedNodeId) {
      await focusTab(previewTabId);
      tabManager.touch(previewTabId, resolvedNodeId);
      tree.setCurrentById(resolvedNodeId);
      treeStorage.cacheTree(tree);
      await notifyTreeUpdate(tree, 'temp-selection', { focusNodeId: resolvedNodeId, mode: 'force' });
      this.end(sessionId);
      return;
    }

    const tabsArray = tabManager.getTabsByRecency(resolvedNodeId);
    for (const tabId of tabsArray) {
      const focused = await focusTab(tabId as TabId);
      if (focused) {
        tabManager.touch(tabId as TabId, resolvedNodeId);
        tree.setCurrentById(resolvedNodeId);
        treeStorage.cacheTree(tree);
        await notifyTreeUpdate(tree, 'temp-selection', { focusNodeId: resolvedNodeId, mode: 'force' });
        this.end(sessionId);
        return;
      }
      tabManager.unregister(tabId as TabId);
    }

    if (session.options.allowCreateOnCommit) {
      const created = await chrome.tabs.create({
        url: node.data.url as Url,
        active: true,
      });
      if (created.id !== undefined) {
        tabManager.register(resolvedNodeId, created.id as TabId);
      }
    }

    tree.setCurrentById(resolvedNodeId);
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, 'temp-selection', { focusNodeId: resolvedNodeId, mode: 'force' });
    this.end(sessionId);
  }

  async cancel(sessionId: SessionId, options?: { keepSession?: boolean }): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const baseTabId = session.baseTabId;
    const baseNodeId = session.baseNodeId;
    const keepSession = options?.keepSession === true;

    if (baseTabId) {
      tabManager.suppressNextActivate(baseTabId, sessionId);
      const focused = await focusTab(baseTabId);
      if (focused) {
        session.previewNodeId = null;
        session.previewTabId = null;
        if (!keepSession) {
          this.end(sessionId);
        }
        return;
      }
      tabManager.clearSuppressActivate(baseTabId);
    }

    if (baseNodeId) {
      const tabsArray = tabManager.getTabsByRecency(baseNodeId);
      for (const tabId of tabsArray) {
        tabManager.suppressNextActivate(tabId as TabId, sessionId);
        const focused = await focusTab(tabId as TabId);
        if (focused) {
          session.previewNodeId = null;
          session.previewTabId = null;
          if (!keepSession) {
            this.end(sessionId);
          }
          return;
        }
        tabManager.clearSuppressActivate(tabId as TabId);
        tabManager.unregister(tabId as TabId);
      }
    }

    session.previewNodeId = null;
    session.previewTabId = null;
    if (!keepSession) {
      this.end(sessionId);
    }
  }

  end(sessionId: SessionId): void {
    if (!this.sessions.has(sessionId)) return;
    tabManager.clearSuppressActivateBySession(sessionId);
    this.sessions.delete(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
  }

  reset(): void {
    for (const sessionId of this.sessions.keys()) {
      this.end(sessionId);
    }
    this.sessions.clear();
    this.activeSessionId = null;
  }

  handleTabActivated(tabId: TabId): void {
    if (!this.activeSessionId) return;
    const session = this.sessions.get(this.activeSessionId);
    if (!session) return;
    if (session.previewTabId === tabId || session.baseTabId === tabId) {
      this.end(session.id);
      return;
    }
    this.end(session.id);
  }
}

export const tempSelectionManager = new TemporaryTabSelectionManager();
