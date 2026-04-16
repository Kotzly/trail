import { registerService } from "@webext-core/proxy-service";
import {
  ACTION_SERVICE_KEY,
  COMMAND_SERVICE_KEY,
  FLAGS_SERVICE_KEY,
  SETTINGS_SERVICE_KEY,
  TABS_SERVICE_KEY,
  TREE_SERVICE_KEY,
  type ActionService,
  type CommandService,
  type FlagsService,
  type SettingsService,
  type TabsService,
  type TreeService,
} from "@shared/transport/proxy-services.js";
import {
  RPC_METHOD,
  type MessageByType,
  type MessageHandler,
  type RequestType,
  type ResponseDataByType,
} from "@shared/rpc/contracts.js";
import { navigationHandlers } from "@background/messaging/handlers/navigation-handlers.js";
import { treeHandlers } from "@background/messaging/handlers/tree-handlers.js";
import { commandHandlers } from "@background/messaging/handlers/undo-handlers.js";
import { settingsHandlers } from "@background/messaging/handlers/settings-handlers.js";
import { flagsHandlers } from "@background/messaging/handlers/flags-handlers.js";
import { tabHandlers } from "@background/messaging/handlers/tab-handlers.js";
import { pinHandlers } from "@background/messaging/handlers/pin-handlers.js";
import { editorHandlers, getEditorState } from "@background/messaging/handlers/editor-handlers.js";
import type { RuntimeMessageSender } from "@shared/platform/webext.js";

const EMPTY_SENDER = {} as RuntimeMessageSender;

/**
 * Invoke an in-process RPC handler. Widens the handler type to accept
 * (message, sender), so callers can use the canonical MessageHandler signature
 * regardless of how a particular handler chose to declare its parameters.
 */
async function call<T extends RequestType>(
  handler: MessageHandler<T> | undefined,
  message: MessageByType<T>,
): Promise<ResponseDataByType[T]> {
  return await handler!(message, EMPTY_SENDER);
}

const treeService: TreeService = {
  navigateTo: (input) =>
    call(navigationHandlers[RPC_METHOD.NAVIGATE_TO], { type: RPC_METHOD.NAVIGATE_TO, ...input }),
  previewNode: (input) =>
    call(navigationHandlers[RPC_METHOD.PREVIEW_NODE], { type: RPC_METHOD.PREVIEW_NODE, ...input }),
  setCurrentNode: (input) =>
    call(navigationHandlers[RPC_METHOD.SET_CURRENT], { type: RPC_METHOD.SET_CURRENT, ...input }),
  beginTempSelection: (input) =>
    call(navigationHandlers[RPC_METHOD.BEGIN_TEMP_SELECTION], {
      type: RPC_METHOD.BEGIN_TEMP_SELECTION,
      ...input,
    }),
  previewTempSelection: (input) =>
    call(navigationHandlers[RPC_METHOD.PREVIEW_TEMP_SELECTION], {
      type: RPC_METHOD.PREVIEW_TEMP_SELECTION,
      ...input,
    }),
  acceptTempSelection: (input) =>
    call(navigationHandlers[RPC_METHOD.ACCEPT_TEMP_SELECTION], {
      type: RPC_METHOD.ACCEPT_TEMP_SELECTION,
      ...input,
    }),
  cancelTempSelection: (input) =>
    call(navigationHandlers[RPC_METHOD.CANCEL_TEMP_SELECTION], {
      type: RPC_METHOD.CANCEL_TEMP_SELECTION,
      ...input,
    }),
  endTempSelection: (input) =>
    call(navigationHandlers[RPC_METHOD.END_TEMP_SELECTION], {
      type: RPC_METHOD.END_TEMP_SELECTION,
      ...input,
    }),
  getTreeState: () => call(treeHandlers[RPC_METHOD.GET_TREE], { type: RPC_METHOD.GET_TREE }),
  getTrees: () => call(treeHandlers[RPC_METHOD.GET_TREES], { type: RPC_METHOD.GET_TREES }),
  clearTree: () => call(treeHandlers[RPC_METHOD.CLEAR_TREE], { type: RPC_METHOD.CLEAR_TREE }),
  createNewTree: (input) =>
    call(treeHandlers[RPC_METHOD.NEW_TREE], { type: RPC_METHOD.NEW_TREE, ...input }),
  archiveActiveTree: () =>
    call(treeHandlers[RPC_METHOD.ARCHIVE_ACTIVE_TREE], { type: RPC_METHOD.ARCHIVE_ACTIVE_TREE }),
  openTree: (input) =>
    call(treeHandlers[RPC_METHOD.OPEN_TREE], { type: RPC_METHOD.OPEN_TREE, ...input }),
  ensureTreeLoaded: (input) =>
    call(treeHandlers[RPC_METHOD.ENSURE_TREE_LOADED], {
      type: RPC_METHOD.ENSURE_TREE_LOADED,
      ...input,
    }),
  renameTree: (input) =>
    call(treeHandlers[RPC_METHOD.RENAME_TREE], { type: RPC_METHOD.RENAME_TREE, ...input }),
  deleteArchivedTree: (input) =>
    call(treeHandlers[RPC_METHOD.DELETE_ARCHIVED_TREE], {
      type: RPC_METHOD.DELETE_ARCHIVED_TREE,
      ...input,
    }),
  exportTree: (input) =>
    call(treeHandlers[RPC_METHOD.EXPORT_TREE], { type: RPC_METHOD.EXPORT_TREE, ...input }),
  setNodeLayout: (input) =>
    call(treeHandlers[RPC_METHOD.SET_NODE_LAYOUT], { type: RPC_METHOD.SET_NODE_LAYOUT, ...input }),
  setNodeLayoutBatch: (input) =>
    call(treeHandlers[RPC_METHOD.SET_NODE_LAYOUT_BATCH], {
      type: RPC_METHOD.SET_NODE_LAYOUT_BATCH,
      ...input,
    }),
  resetNodeLayouts: () =>
    call(treeHandlers[RPC_METHOD.RESET_NODE_LAYOUTS], { type: RPC_METHOD.RESET_NODE_LAYOUTS }),
  importTrail: (input) =>
    call(treeHandlers[RPC_METHOD.IMPORT_TRAIL], { type: RPC_METHOD.IMPORT_TRAIL, ...input }),
  reparentNode: (input) =>
    call(editorHandlers[RPC_METHOD.REPARENT_NODE], { type: RPC_METHOD.REPARENT_NODE, ...input }),
  renameNode: (input) =>
    call(editorHandlers[RPC_METHOD.RENAME_NODE], { type: RPC_METHOD.RENAME_NODE, ...input }),
};

const commandService: CommandService = {
  getCommandState: () =>
    call(commandHandlers[RPC_METHOD.COMMAND_STATE], { type: RPC_METHOD.COMMAND_STATE }),
  undo: () => call(commandHandlers[RPC_METHOD.UNDO], { type: RPC_METHOD.UNDO }),
  redo: () => call(commandHandlers[RPC_METHOD.REDO], { type: RPC_METHOD.REDO }),
};

const settingsService: SettingsService = {
  getSettings: () =>
    call(settingsHandlers[RPC_METHOD.GET_SETTINGS], { type: RPC_METHOD.GET_SETTINGS }),
  saveSettings: (input) =>
    call(settingsHandlers[RPC_METHOD.SAVE_SETTINGS], {
      type: RPC_METHOD.SAVE_SETTINGS,
      ...input,
    }),
};

const flagsService: FlagsService = {
  getFlags: () => call(flagsHandlers[RPC_METHOD.GET_FLAGS], { type: RPC_METHOD.GET_FLAGS }),
  setFlag: (input) =>
    call(flagsHandlers[RPC_METHOD.SET_FLAG], { type: RPC_METHOD.SET_FLAG, ...input }),
  resetFlags: () => call(flagsHandlers[RPC_METHOD.RESET_FLAGS], { type: RPC_METHOD.RESET_FLAGS }),
};

const tabsService: TabsService = {
  async getTabsForNode(input) {
    const result = await call(tabHandlers[RPC_METHOD.GET_TABS_FOR_NODE], {
      type: RPC_METHOD.GET_TABS_FOR_NODE,
      ...input,
    });
    return result.tabs;
  },
};

const actionService: ActionService = {
  openInNewTab: (input) =>
    call(navigationHandlers[RPC_METHOD.OPEN_IN_NEW_TAB], {
      type: RPC_METHOD.OPEN_IN_NEW_TAB,
      ...input,
    }),
  toggleMute: (input) =>
    call(tabHandlers[RPC_METHOD.TOGGLE_MUTE], { type: RPC_METHOD.TOGGLE_MUTE, ...input }),
  closeTab: (input) =>
    call(tabHandlers[RPC_METHOD.CLOSE_TAB], { type: RPC_METHOD.CLOSE_TAB, ...input }),
  bulkCloseTabs: (input) =>
    call(tabHandlers[RPC_METHOD.BULK_CLOSE_TABS], { type: RPC_METHOD.BULK_CLOSE_TABS, ...input }),
  togglePin: (input) =>
    call(pinHandlers[RPC_METHOD.TOGGLE_PIN], { type: RPC_METHOD.TOGGLE_PIN, ...input }),
  bulkPin: (input) =>
    call(pinHandlers[RPC_METHOD.BULK_PIN], { type: RPC_METHOD.BULK_PIN, ...input }),
  bulkUnpin: (input) =>
    call(pinHandlers[RPC_METHOD.BULK_UNPIN], { type: RPC_METHOD.BULK_UNPIN, ...input }),
  deleteNode: (input) =>
    call(treeHandlers[RPC_METHOD.DELETE_NODE], { type: RPC_METHOD.DELETE_NODE, ...input }),
  deleteChildren: (input) =>
    call(treeHandlers[RPC_METHOD.DELETE_CHILDREN], { type: RPC_METHOD.DELETE_CHILDREN, ...input }),
  deleteWithChildren: (input) =>
    call(treeHandlers[RPC_METHOD.DELETE_WITH_CHILDREN], {
      type: RPC_METHOD.DELETE_WITH_CHILDREN,
      ...input,
    }),
  bulkDelete: (input) =>
    call(treeHandlers[RPC_METHOD.BULK_DELETE], { type: RPC_METHOD.BULK_DELETE, ...input }),
  bulkDeleteNodes: (input) =>
    call(treeHandlers[RPC_METHOD.BULK_DELETE_NODES], {
      type: RPC_METHOD.BULK_DELETE_NODES,
      ...input,
    }),
  bulkDeleteRecursive: (input) =>
    call(treeHandlers[RPC_METHOD.BULK_DELETE_RECURSIVE], {
      type: RPC_METHOD.BULK_DELETE_RECURSIVE,
      ...input,
    }),
  enterEditorMode: (input) =>
    call(editorHandlers[RPC_METHOD.ENTER_EDITOR_MODE], {
      type: RPC_METHOD.ENTER_EDITOR_MODE,
      ...input,
    }),
  exitEditorMode: () =>
    call(editorHandlers[RPC_METHOD.EXIT_EDITOR_MODE], { type: RPC_METHOD.EXIT_EDITOR_MODE }),
  cancelEditorMode: () =>
    call(editorHandlers[RPC_METHOD.CANCEL_EDITOR_MODE], { type: RPC_METHOD.CANCEL_EDITOR_MODE }),
  async getEditorModeState() {
    return getEditorState();
  },
};

export function registerProxyServices(): void {
  registerService(TREE_SERVICE_KEY, treeService);
  registerService(COMMAND_SERVICE_KEY, commandService);
  registerService(SETTINGS_SERVICE_KEY, settingsService);
  registerService(FLAGS_SERVICE_KEY, flagsService);
  registerService(TABS_SERVICE_KEY, tabsService);
  registerService(ACTION_SERVICE_KEY, actionService);
}
