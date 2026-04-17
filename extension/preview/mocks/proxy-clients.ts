// Replacement for @shared/transport/proxy-clients.js — returns canned data
// for every service method. Keeps ContextMenus / sidepanel UI workable
// without a service worker.

import type { NodeId, TabId } from "@shared/types/ids.js";
import { fakeSettings, fakeFlags, fakeTreeUpdatedInput, fakeTabs } from "../fake-tree";

const log =
  (name: string) =>
  (...args: unknown[]): void => {
    console.debug(`[preview] ${name}`, ...args);
  };

const asyncOk =
  (name: string) =>
  async (...args: unknown[]): Promise<void> => {
    log(name)(...args);
  };

export const treeService = {
  getTreeState: async () => fakeTreeUpdatedInput(),
  getTrees: async () => ({ active: null, archived: [] }),
  navigateTo: asyncOk("navigateTo"),
  previewNode: asyncOk("previewNode"),
  setCurrentNode: asyncOk("setCurrentNode"),
  beginTempSelection: async () => ({ sessionId: "preview-session" }),
  previewTempSelection: async () => ({ previewedTabId: null }),
  acceptTempSelection: asyncOk("acceptTempSelection"),
  cancelTempSelection: asyncOk("cancelTempSelection"),
  endTempSelection: asyncOk("endTempSelection"),
  clearTree: asyncOk("clearTree"),
  createNewTree: asyncOk("createNewTree"),
  openTree: asyncOk("openTree"),
  ensureTreeLoaded: async () => true,
  renameTree: asyncOk("renameTree"),
  archiveActiveTree: asyncOk("archiveActiveTree"),
  deleteArchivedTree: asyncOk("deleteArchivedTree"),
  exportTree: async () => ({ format: "json", data: "{}" }),
  importTree: asyncOk("importTree"),
};

export const commandService = {
  setCommand: asyncOk("setCommand"),
};

export const settingsService = {
  getSettings: async () => fakeSettings(),
  saveSettings: asyncOk("saveSettings"),
};

export const flagsService = {
  getFlags: async () => fakeFlags(),
  setFlag: async () => fakeFlags(),
  resetFlags: async () => fakeFlags(),
};

export const tabsService = {
  getTabsForNode: async ({ nodeId }: { nodeId: NodeId }) => fakeTabs(nodeId),
};

export const actionService = {
  openInNewTab: asyncOk("openInNewTab"),
  toggleMute: asyncOk("toggleMute"),
  closeTab: asyncOk("closeTab"),
  bulkCloseTabs: asyncOk("bulkCloseTabs"),
  togglePin: asyncOk("togglePin"),
  bulkPin: asyncOk("bulkPin"),
  bulkUnpin: asyncOk("bulkUnpin"),
  deleteNode: asyncOk("deleteNode"),
  deleteChildren: asyncOk("deleteChildren"),
  deleteWithChildren: asyncOk("deleteWithChildren"),
  bulkDelete: asyncOk("bulkDelete"),
  bulkDeleteNodes: asyncOk("bulkDeleteNodes"),
  bulkDeleteRecursive: asyncOk("bulkDeleteRecursive"),
  exitEditorMode: asyncOk("exitEditorMode"),
  get tabId(): number {
    return 1 as unknown as number;
  },
};

export const cleanupService = {
  listTombstones: async () => [],
  restoreTombstone: async () => null,
  dismissTombstone: asyncOk("dismissTombstone"),
  clearTombstones: asyncOk("clearTombstones"),
};

export type ProxyServices = {
  treeService: typeof treeService;
  commandService: typeof commandService;
  settingsService: typeof settingsService;
  flagsService: typeof flagsService;
  tabsService: typeof tabsService;
  actionService: typeof actionService;
  cleanupService: typeof cleanupService;
};

// Silence unused imports for TabId
export type _TabIdHint = TabId;
