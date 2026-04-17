import type { Description, NodeId, Title, Url, TabId, FaviconUrl } from "../types/ids.js";
import { type Settings } from "../types/settings.js";
import { type TabState } from "../types/tabs.js";
import { type NavigationTreeJSON, type TreeMeta, type ArchiveIndexEntry } from "../types/tree.js";
import type { TrailExportBundle } from "../types/export.js";
import type { FlagKey, ResolvedFlags } from "../types/flags.js";
import { type RuntimeMessageSender, type Tab } from "@shared/platform/webext.js";

export const RPC_METHOD = {
  NAVIGATE_TO: "NAVIGATE_TO",
  PREVIEW_NODE: "PREVIEW_NODE",
  SET_CURRENT: "SET_CURRENT",
  BEGIN_TEMP_SELECTION: "BEGIN_TEMP_SELECTION",
  PREVIEW_TEMP_SELECTION: "PREVIEW_TEMP_SELECTION",
  ACCEPT_TEMP_SELECTION: "ACCEPT_TEMP_SELECTION",
  CANCEL_TEMP_SELECTION: "CANCEL_TEMP_SELECTION",
  END_TEMP_SELECTION: "END_TEMP_SELECTION",
  OPEN_PANEL: "OPEN_PANEL",
  UNDO: "UNDO",
  REDO: "REDO",
  COMMAND_STATE: "COMMAND_STATE",
  GET_TABS_FOR_NODE: "GET_TABS_FOR_NODE",
  SAVE_SETTINGS: "SAVE_SETTINGS",
  GET_SETTINGS: "GET_SETTINGS",
  TITLE_OR_FAVICON_CHANGED: "TITLE_OR_FAVICON_CHANGED",
  GET_TREE: "GET_TREE",
  GET_TREES: "GET_TREES",
  CLEAR_TREE: "CLEAR_TREE",
  NEW_TREE: "NEW_TREE",
  ARCHIVE_ACTIVE_TREE: "ARCHIVE_ACTIVE_TREE",
  OPEN_TREE: "OPEN_TREE",
  RENAME_TREE: "RENAME_TREE",
  DELETE_ARCHIVED_TREE: "DELETE_ARCHIVED_TREE",
  EXPORT_TREE: "EXPORT_TREE",
  OPEN_IN_NEW_TAB: "OPEN_IN_NEW_TAB",
  TOGGLE_MUTE: "TOGGLE_MUTE",
  CLOSE_TAB: "CLOSE_TAB",
  BULK_CLOSE_TABS: "BULK_CLOSE_TABS",
  TOGGLE_PIN: "TOGGLE_PIN",
  BULK_PIN: "BULK_PIN",
  BULK_UNPIN: "BULK_UNPIN",
  DELETE_NODE: "DELETE_NODE",
  DELETE_CHILDREN: "DELETE_CHILDREN",
  DELETE_WITH_CHILDREN: "DELETE_WITH_CHILDREN",
  BULK_DELETE: "BULK_DELETE",
  BULK_DELETE_NODES: "BULK_DELETE_NODES",
  BULK_DELETE_RECURSIVE: "BULK_DELETE_RECURSIVE",
  SET_NODE_LAYOUT: "SET_NODE_LAYOUT",
  SET_NODE_LAYOUT_BATCH: "SET_NODE_LAYOUT_BATCH",
  RESET_NODE_LAYOUTS: "RESET_NODE_LAYOUTS",
  ENTER_EDITOR_MODE: "ENTER_EDITOR_MODE",
  EXIT_EDITOR_MODE: "EXIT_EDITOR_MODE",
  CANCEL_EDITOR_MODE: "CANCEL_EDITOR_MODE",
  REPARENT_NODE: "REPARENT_NODE",
  RENAME_NODE: "RENAME_NODE",
  DUPLICATE_SUBTREE: "DUPLICATE_SUBTREE",
  ENSURE_TREE_LOADED: "ENSURE_TREE_LOADED",
  GET_FLAGS: "GET_FLAGS",
  SET_FLAG: "SET_FLAG",
  RESET_FLAGS: "RESET_FLAGS",
  GET_LOCAL_TRAIL_DETAIL: "GET_LOCAL_TRAIL_DETAIL",
  IMPORT_TRAIL: "IMPORT_TRAIL",
  // Cleanup / tombstone RPCs
  LIST_CLEANUP_TOMBSTONES: "LIST_CLEANUP_TOMBSTONES",
  RESTORE_CLEANUP_TOMBSTONE: "RESTORE_CLEANUP_TOMBSTONE",
  CLEAR_CLEANUP_TOMBSTONES: "CLEAR_CLEANUP_TOMBSTONES",
  DISMISS_CLEANUP_TOMBSTONE: "DISMISS_CLEANUP_TOMBSTONE",
} as const;

export type RequestType = (typeof RPC_METHOD)[keyof typeof RPC_METHOD];

// ==== Requests ====
export type RequestMessageBase<T extends string, P = {}> = { type: T } & P;

export type NavigateToMessage = RequestMessageBase<
  typeof RPC_METHOD.NAVIGATE_TO,
  {
    url?: Url;
    nodeId: NodeId;
  }
>;
export type PreviewNodeMessage = RequestMessageBase<
  typeof RPC_METHOD.PREVIEW_NODE,
  {
    nodeId: NodeId;
  }
>;
export type SetCurrentMessage = RequestMessageBase<
  typeof RPC_METHOD.SET_CURRENT,
  {
    nodeId: NodeId;
  }
>;
export type TempSelectionSessionId = string;
export type TempSelectionOptions = {
  allowCreateOnCommit?: boolean;
  allowPreviewWithoutTabs?: boolean;
};
export type BeginTempSelectionInput = {
  baseNodeId?: NodeId | null;
  options?: TempSelectionOptions;
};
export type BeginTempSelectionMessage = RequestMessageBase<
  typeof RPC_METHOD.BEGIN_TEMP_SELECTION,
  BeginTempSelectionInput
>;
export type PreviewTempSelectionMessage = RequestMessageBase<
  typeof RPC_METHOD.PREVIEW_TEMP_SELECTION,
  {
    sessionId: TempSelectionSessionId;
    nodeId: NodeId;
    tabId?: TabId;
  }
>;
export type AcceptTempSelectionMessage = RequestMessageBase<
  typeof RPC_METHOD.ACCEPT_TEMP_SELECTION,
  {
    sessionId: TempSelectionSessionId;
    nodeId?: NodeId;
  }
>;
export type CancelTempSelectionMessage = RequestMessageBase<
  typeof RPC_METHOD.CANCEL_TEMP_SELECTION,
  {
    sessionId: TempSelectionSessionId;
    keepSession?: boolean;
  }
>;
export type EndTempSelectionMessage = RequestMessageBase<
  typeof RPC_METHOD.END_TEMP_SELECTION,
  {
    sessionId: TempSelectionSessionId;
  }
>;
export type OpenPanelMessage = RequestMessageBase<typeof RPC_METHOD.OPEN_PANEL>;

export type UndoMessage = RequestMessageBase<typeof RPC_METHOD.UNDO>;
export type RedoMessage = RequestMessageBase<typeof RPC_METHOD.REDO>;
export type CommandStateMessage = RequestMessageBase<typeof RPC_METHOD.COMMAND_STATE>;
export type TabsForNodeMessage = RequestMessageBase<
  typeof RPC_METHOD.GET_TABS_FOR_NODE,
  TabsForNodeInput
>;
export type SaveSettingsMessage = RequestMessageBase<
  typeof RPC_METHOD.SAVE_SETTINGS,
  SaveSettingsInput
>;
export type GetSettingsMessage = RequestMessageBase<typeof RPC_METHOD.GET_SETTINGS>;
export type TitleOrFaviconChangedMessage = RequestMessageBase<
  typeof RPC_METHOD.TITLE_OR_FAVICON_CHANGED,
  TitleOrFaviconChangedInput
>;
export type UiNotificationInput = {
  message: string;
  icon?: string;
  durationMs?: number;
};
export type GetTreeMessage = RequestMessageBase<typeof RPC_METHOD.GET_TREE>;
export type GetTreesMessage = RequestMessageBase<typeof RPC_METHOD.GET_TREES>;
export type ClearTreeMessage = RequestMessageBase<typeof RPC_METHOD.CLEAR_TREE>;
export type NewTreeMessage = RequestMessageBase<typeof RPC_METHOD.NEW_TREE, { label: string }>;
export type ArchiveActiveTreeMessage = RequestMessageBase<typeof RPC_METHOD.ARCHIVE_ACTIVE_TREE>;
export type OpenTreeMessage = RequestMessageBase<typeof RPC_METHOD.OPEN_TREE, { treeId: string }>;
export type EnsureTreeLoadedMessage = RequestMessageBase<
  typeof RPC_METHOD.ENSURE_TREE_LOADED,
  { treeId: string }
>;
export type RenameTreeMessage = RequestMessageBase<
  typeof RPC_METHOD.RENAME_TREE,
  { treeId: string; label: string }
>;
export type RenameNodeMessage = RequestMessageBase<
  typeof RPC_METHOD.RENAME_NODE,
  { nodeId: NodeId; title: string }
>;
export type DeleteArchivedTreeMessage = RequestMessageBase<
  typeof RPC_METHOD.DELETE_ARCHIVED_TREE,
  { treeId: string }
>;
export type ExportTreeMessage = RequestMessageBase<
  typeof RPC_METHOD.EXPORT_TREE,
  { treeId?: string }
>;

export type OpenInNewTabMessage = RequestMessageBase<
  typeof RPC_METHOD.OPEN_IN_NEW_TAB,
  {
    nodeId: NodeId;
  }
>;

export type ToggleMuteMessage = RequestMessageBase<
  typeof RPC_METHOD.TOGGLE_MUTE,
  { nodeId: NodeId; tabId: TabId }
>;
export type CloseTabMessage = RequestMessageBase<
  typeof RPC_METHOD.CLOSE_TAB,
  { nodeId: NodeId; tabId: TabId }
>;
export type BulkCloseTabsMessage = RequestMessageBase<
  typeof RPC_METHOD.BULK_CLOSE_TABS,
  BulkNodeIdsInput
>;

export type TogglePinMessage = RequestMessageBase<typeof RPC_METHOD.TOGGLE_PIN, { nodeId: NodeId }>;
export type BulkPinMessage = RequestMessageBase<typeof RPC_METHOD.BULK_PIN, BulkNodeIdsInput>;
export type BulkUnpinMessage = RequestMessageBase<typeof RPC_METHOD.BULK_UNPIN, BulkNodeIdsInput>;

export type NodeLayoutInput = {
  nodeId: NodeId;
  offsetX?: number;
  offsetY?: number;
};

export type SetNodeLayoutMessage = RequestMessageBase<
  typeof RPC_METHOD.SET_NODE_LAYOUT,
  NodeLayoutInput
>;
export type SetNodeLayoutBatchMessage = RequestMessageBase<
  typeof RPC_METHOD.SET_NODE_LAYOUT_BATCH,
  {
    layouts: NodeLayoutInput[];
  }
>;
export type ResetNodeLayoutsMessage = RequestMessageBase<typeof RPC_METHOD.RESET_NODE_LAYOUTS>;

export type DeleteNodeMessage = RequestMessageBase<
  typeof RPC_METHOD.DELETE_NODE,
  { nodeId: NodeId }
>;
export type DeleteChildrenMessage = RequestMessageBase<
  typeof RPC_METHOD.DELETE_CHILDREN,
  { nodeId: NodeId }
>;
export type DeleteWithChildrenMessage = RequestMessageBase<
  typeof RPC_METHOD.DELETE_WITH_CHILDREN,
  { nodeId: NodeId }
>;
export type BulkDeleteMessage = RequestMessageBase<typeof RPC_METHOD.BULK_DELETE, BulkNodeIdsInput>;
export type BulkDeleteNodesMessage = RequestMessageBase<
  typeof RPC_METHOD.BULK_DELETE_NODES,
  BulkNodeIdsInput
>;
export type BulkDeleteRecursiveMessage = RequestMessageBase<
  typeof RPC_METHOD.BULK_DELETE_RECURSIVE,
  BulkNodeIdsInput
>;

export type EnterEditorModeMessage = RequestMessageBase<
  typeof RPC_METHOD.ENTER_EDITOR_MODE,
  { treeId: string }
>;
export type ExitEditorModeMessage = RequestMessageBase<typeof RPC_METHOD.EXIT_EDITOR_MODE>;
export type CancelEditorModeMessage = RequestMessageBase<typeof RPC_METHOD.CANCEL_EDITOR_MODE>;
export type ReparentNodeMessage = RequestMessageBase<
  typeof RPC_METHOD.REPARENT_NODE,
  {
    nodeId: NodeId;
    newParentId: NodeId;
  }
>;
export type DuplicateSubtreeMessage = RequestMessageBase<
  typeof RPC_METHOD.DUPLICATE_SUBTREE,
  {
    nodeId: NodeId;
    targetParentId: NodeId;
  }
>;

export type EditorModeState = {
  active: boolean;
  treeId: string | null;
};

export type SetFlagInput = { key: FlagKey; value: unknown };
export type GetFlagsMessage = RequestMessageBase<typeof RPC_METHOD.GET_FLAGS>;
export type SetFlagMessage = RequestMessageBase<typeof RPC_METHOD.SET_FLAG, SetFlagInput>;
export type ResetFlagsMessage = RequestMessageBase<typeof RPC_METHOD.RESET_FLAGS>;

export type LocalTrailDetail = {
  id: string;
  label: string;
  createdAt: number;
  savedAt: number;
  nodeCount: number;
  rootUrl?: Url | undefined;
  rootTitle?: Title | undefined;
  rootFavicon?: FaviconUrl | undefined;
  tree: NavigationTreeJSON;
};

export type GetLocalTrailDetailMessage = RequestMessageBase<
  typeof RPC_METHOD.GET_LOCAL_TRAIL_DETAIL,
  {
    treeId: string;
  }
>;

export type ImportTrailMessage = RequestMessageBase<
  typeof RPC_METHOD.IMPORT_TRAIL,
  {
    bundle: TrailExportBundle;
  }
>;

// Cleanup / tombstone RPCs
export type ListCleanupTombstonesMessage = RequestMessageBase<
  typeof RPC_METHOD.LIST_CLEANUP_TOMBSTONES,
  {}
>;
export type RestoreCleanupTombstoneMessage = RequestMessageBase<
  typeof RPC_METHOD.RESTORE_CLEANUP_TOMBSTONE,
  { nodeId: string }
>;
export type ClearCleanupTombstonesMessage = RequestMessageBase<
  typeof RPC_METHOD.CLEAR_CLEANUP_TOMBSTONES,
  {}
>;
export type DismissCleanupTombstoneMessage = RequestMessageBase<
  typeof RPC_METHOD.DISMISS_CLEANUP_TOMBSTONE,
  { nodeId: string }
>;

export type RequestMessage =
  | NavigateToMessage
  | PreviewNodeMessage
  | SetCurrentMessage
  | BeginTempSelectionMessage
  | PreviewTempSelectionMessage
  | AcceptTempSelectionMessage
  | CancelTempSelectionMessage
  | EndTempSelectionMessage
  | OpenPanelMessage
  | UndoMessage
  | RedoMessage
  | CommandStateMessage
  | TabsForNodeMessage
  | SaveSettingsMessage
  | GetSettingsMessage
  | TitleOrFaviconChangedMessage
  | GetTreeMessage
  | GetTreesMessage
  | ClearTreeMessage
  | NewTreeMessage
  | OpenTreeMessage
  | EnsureTreeLoadedMessage
  | RenameTreeMessage
  | DeleteArchivedTreeMessage
  | ExportTreeMessage
  | ArchiveActiveTreeMessage
  | OpenInNewTabMessage
  | ToggleMuteMessage
  | CloseTabMessage
  | BulkCloseTabsMessage
  | TogglePinMessage
  | BulkPinMessage
  | BulkUnpinMessage
  | DeleteNodeMessage
  | DeleteChildrenMessage
  | DeleteWithChildrenMessage
  | BulkDeleteMessage
  | BulkDeleteNodesMessage
  | BulkDeleteRecursiveMessage
  | SetNodeLayoutMessage
  | SetNodeLayoutBatchMessage
  | ResetNodeLayoutsMessage
  | EnterEditorModeMessage
  | ExitEditorModeMessage
  | CancelEditorModeMessage
  | ReparentNodeMessage
  | RenameNodeMessage
  | DuplicateSubtreeMessage
  | GetFlagsMessage
  | SetFlagMessage
  | ResetFlagsMessage
  | GetLocalTrailDetailMessage
  | ImportTrailMessage
  | ListCleanupTombstonesMessage
  | RestoreCleanupTombstoneMessage
  | ClearCleanupTombstonesMessage
  | DismissCleanupTombstoneMessage;

// ==== Responses ====

export type ResponseDataByType = {
  [RPC_METHOD.NAVIGATE_TO]: void;
  [RPC_METHOD.PREVIEW_NODE]: void;
  [RPC_METHOD.SET_CURRENT]: void;
  [RPC_METHOD.BEGIN_TEMP_SELECTION]: { sessionId: TempSelectionSessionId };
  [RPC_METHOD.PREVIEW_TEMP_SELECTION]: { previewedTabId: TabId | null };
  [RPC_METHOD.ACCEPT_TEMP_SELECTION]: void;
  [RPC_METHOD.CANCEL_TEMP_SELECTION]: void;
  [RPC_METHOD.END_TEMP_SELECTION]: void;
  [RPC_METHOD.OPEN_PANEL]: void;
  [RPC_METHOD.UNDO]: CommandState;
  [RPC_METHOD.REDO]: CommandState;
  [RPC_METHOD.COMMAND_STATE]: CommandState;
  [RPC_METHOD.GET_TABS_FOR_NODE]: TabsForNodeData;
  [RPC_METHOD.SAVE_SETTINGS]: void;
  [RPC_METHOD.GET_SETTINGS]: Settings;
  [RPC_METHOD.TITLE_OR_FAVICON_CHANGED]: void;
  [RPC_METHOD.GET_TREE]: TreeUpdatedInput;
  [RPC_METHOD.GET_TREES]: TreesSnapshot;
  [RPC_METHOD.CLEAR_TREE]: void;
  [RPC_METHOD.NEW_TREE]: void;
  [RPC_METHOD.ARCHIVE_ACTIVE_TREE]: void;
  [RPC_METHOD.OPEN_TREE]: void;
  [RPC_METHOD.RENAME_TREE]: void;
  [RPC_METHOD.DELETE_ARCHIVED_TREE]: void;
  [RPC_METHOD.EXPORT_TREE]: TrailExportBundle;
  [RPC_METHOD.OPEN_IN_NEW_TAB]: void;
  [RPC_METHOD.TOGGLE_MUTE]: void;
  [RPC_METHOD.CLOSE_TAB]: void;
  [RPC_METHOD.BULK_CLOSE_TABS]: void;
  [RPC_METHOD.TOGGLE_PIN]: void;
  [RPC_METHOD.BULK_PIN]: void;
  [RPC_METHOD.BULK_UNPIN]: void;
  [RPC_METHOD.DELETE_NODE]: void;
  [RPC_METHOD.DELETE_CHILDREN]: void;
  [RPC_METHOD.DELETE_WITH_CHILDREN]: void;
  [RPC_METHOD.BULK_DELETE]: void;
  [RPC_METHOD.BULK_DELETE_NODES]: void;
  [RPC_METHOD.BULK_DELETE_RECURSIVE]: void;
  [RPC_METHOD.SET_NODE_LAYOUT]: void;
  [RPC_METHOD.SET_NODE_LAYOUT_BATCH]: void;
  [RPC_METHOD.RESET_NODE_LAYOUTS]: void;
  [RPC_METHOD.ENTER_EDITOR_MODE]: EditorModeState;
  [RPC_METHOD.EXIT_EDITOR_MODE]: EditorModeState;
  [RPC_METHOD.CANCEL_EDITOR_MODE]: EditorModeState;
  [RPC_METHOD.REPARENT_NODE]: void;
  [RPC_METHOD.RENAME_NODE]: void;
  [RPC_METHOD.DUPLICATE_SUBTREE]: void;
  [RPC_METHOD.ENSURE_TREE_LOADED]: boolean;
  [RPC_METHOD.GET_FLAGS]: ResolvedFlags;
  [RPC_METHOD.SET_FLAG]: ResolvedFlags;
  [RPC_METHOD.RESET_FLAGS]: ResolvedFlags;
  [RPC_METHOD.GET_LOCAL_TRAIL_DETAIL]: LocalTrailDetail;
  [RPC_METHOD.IMPORT_TRAIL]: { treeId: string };
  [RPC_METHOD.LIST_CLEANUP_TOMBSTONES]: CleanupTombstoneEntry[];
  [RPC_METHOD.RESTORE_CLEANUP_TOMBSTONE]: { restoredNodeId: NodeId } | null;
  [RPC_METHOD.CLEAR_CLEANUP_TOMBSTONES]: void;
  [RPC_METHOD.DISMISS_CLEANUP_TOMBSTONE]: void;
};

export type CleanupTombstoneEntry = {
  nodeId: string;
  url: string;
  title: string;
  favicon: string | null;
  parentId: string | null;
  removedAt: number;
  reason: "glance" | "round-trip";
};

export type MessageByType<T extends RequestType> = Extract<RequestMessage, { type: T }>;

// ==== message handler ====

export type MessageHandler<T extends RequestType = RequestType> = (
  message: MessageByType<T>,
  sender: RuntimeMessageSender,
) => Promise<ResponseDataByType[T]> | ResponseDataByType[T];

export type HandlerMap = Partial<{ [K in RequestType]: MessageHandler<K> }>;

export function defineRpcHandlers<const H extends HandlerMap>(h: H): H {
  return h;
}

export type StrictHandlerMap = { [K in RequestType]: MessageHandler<K> };

export function defineStrictRpcHandlers<const H extends StrictHandlerMap>(h: H): H {
  return h;
}

// ==== data types ====

export type CommandState = {
  canUndo: boolean;
  canRedo: boolean;
  nextUndoDesc?: Description;
  nextRedoDesc?: Description;
};

export type NavigateToData = {
  url?: Url;
  nodeId: NodeId;
};

export type TabsForNodeInput = {
  nodeId: NodeId;
};

export type TabsForNodeData = {
  tabs: Tab[];
};

export type SaveSettingsInput = {
  settings: Settings;
};

export type TitleOrFaviconChangedInput = {
  url: Url;
  favicon?: FaviconUrl;
  title?: Title;
};

export type TreeUpdateReason =
  | "navigate"
  | "set-current"
  | "tree-reset"
  | "tree-switch"
  | "layout"
  | "delete"
  | "undo"
  | "pins"
  | "tabs"
  | "temp-selection"
  | "sync"
  | "reparent"
  | "rename"
  | "duplicate"
  | "editor-enter"
  | "editor-exit";

export type TreeViewIntentMode = "force" | "soft";

export type TreeViewIntent = {
  focusNodeId?: NodeId;
  fitToView?: boolean;
  /** Restore exact view coordinates (used by Spotlight tree-switch cache). */
  restoreView?: { translateX: number; translateY: number; scale: number };
  mode?: TreeViewIntentMode;
  intentId?: number;
};

export type TreeUpdatedInput = {
  tree: NavigationTreeJSON;
  openNodeIds: NodeId[];
  tabStates: Record<NodeId, TabState>;
  nodeTabCounts: Record<NodeId, number>;
  nodeRecency: Record<NodeId, number>;
  reason: TreeUpdateReason;
  view?: TreeViewIntent;
  editorMode?: EditorModeState;
  /** Pre-computed node positions from background ELK (fully-expanded tree). */
  positions?: Record<string, { x: number; y: number }>;
  /** Undo/redo state — avoids a follow-up getCommandState() RPC on every update. */
  commandState: CommandState;
};

export type TreesSnapshot = {
  active: TreeMeta;
  archived: ArchiveIndexEntry[];
};

export type BulkNodeIdsInput = {
  nodeIds: NodeId[];
};
