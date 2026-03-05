import type { Description, NodeId, Title, Url, Tag, TabId, FaviconUrl } from "../types/ids.js";
import { Settings } from "../types/settings.js";
import { TabState } from "../types/tabs.js";
import { NavigationTreeJSON, TreeMeta, TreeSummary, ArchiveIndexEntry } from "../types/tree.js";
import type { TagDefinition } from "../types/tags.js";
import type { TrailExportBundle } from "../types/export.js";
import type { FlagKey, ResolvedFlags } from "../types/flags.js";
import { type RuntimeMessageSender, type Tab } from '@shared/platform/webext.js';

export const RPC_METHOD = {
    NAVIGATE_TO: 'NAVIGATE_TO',
    PREVIEW_NODE: 'PREVIEW_NODE',
    SET_CURRENT: 'SET_CURRENT',
    BEGIN_TEMP_SELECTION: 'BEGIN_TEMP_SELECTION',
    PREVIEW_TEMP_SELECTION: 'PREVIEW_TEMP_SELECTION',
    ACCEPT_TEMP_SELECTION: 'ACCEPT_TEMP_SELECTION',
    CANCEL_TEMP_SELECTION: 'CANCEL_TEMP_SELECTION',
    END_TEMP_SELECTION: 'END_TEMP_SELECTION',
    OPEN_PANEL: 'OPEN_PANEL',
    UNDO: 'UNDO',
    REDO: 'REDO',
    COMMAND_STATE: 'COMMAND_STATE',
    GET_TAG_DEFS: 'GET_TAG_DEFS',
    UPSERT_TAG_DEF: 'UPSERT_TAG_DEF',
    DELETE_TAG_DEF: 'DELETE_TAG_DEF',
    GET_TABS_FOR_NODE: 'GET_TABS_FOR_NODE',
    SAVE_SETTINGS: 'SAVE_SETTINGS',
    GET_SETTINGS: 'GET_SETTINGS',
    TITLE_OR_FAVICON_CHANGED: 'TITLE_OR_FAVICON_CHANGED',
    TREE_UPDATED: 'TREE_UPDATED',
    TREES_UPDATED: 'TREES_UPDATED',
    TAGS_UPDATED: 'TAGS_UPDATED',
    NOTIFY: 'NOTIFY',
    GET_TREE: 'GET_TREE',
    GET_TREES: 'GET_TREES',
    CLEAR_TREE: 'CLEAR_TREE',
    NEW_TREE: 'NEW_TREE',
    OPEN_TREE: 'OPEN_TREE',
    RENAME_TREE: 'RENAME_TREE',
    DELETE_ARCHIVED_TREE: 'DELETE_ARCHIVED_TREE',
    EXPORT_TREE: 'EXPORT_TREE',
    OPEN_IN_NEW_TAB: 'OPEN_IN_NEW_TAB',
    TOGGLE_MUTE: 'TOGGLE_MUTE',
    CLOSE_TAB: 'CLOSE_TAB',
    BULK_CLOSE_TABS: 'BULK_CLOSE_TABS',
    TOGGLE_PIN: 'TOGGLE_PIN',
    BULK_PIN: 'BULK_PIN',
    BULK_UNPIN: 'BULK_UNPIN',
    ADD_TAG: 'ADD_TAG',
    REMOVE_TAG: 'REMOVE_TAG',
    DELETE_NODE: 'DELETE_NODE',
    DELETE_CHILDREN: 'DELETE_CHILDREN',
    DELETE_WITH_CHILDREN: 'DELETE_WITH_CHILDREN',
    BULK_DELETE: 'BULK_DELETE',
    BULK_DELETE_NODES: 'BULK_DELETE_NODES',
    BULK_DELETE_RECURSIVE: 'BULK_DELETE_RECURSIVE',
    SET_NODE_LAYOUT: 'SET_NODE_LAYOUT',
    SET_NODE_LAYOUT_BATCH: 'SET_NODE_LAYOUT_BATCH',
    RESET_NODE_LAYOUTS: 'RESET_NODE_LAYOUTS',
    ENTER_EDITOR_MODE: 'ENTER_EDITOR_MODE',
    EXIT_EDITOR_MODE: 'EXIT_EDITOR_MODE',
    REPARENT_NODE: 'REPARENT_NODE',
    DUPLICATE_SUBTREE: 'DUPLICATE_SUBTREE',
    SYNC_STATUS_UPDATED: 'SYNC_STATUS_UPDATED',
    EDITOR_SYNC_RETRY: 'EDITOR_SYNC_RETRY',
    SITE_MESSAGE_FORWARD: 'SITE_MESSAGE_FORWARD',
    OAUTH_INTERACTIVE_LOGIN: 'OAUTH_INTERACTIVE_LOGIN',
    OAUTH_SILENT_SYNC: 'OAUTH_SILENT_SYNC',
    ENSURE_TREE_LOADED: 'ENSURE_TREE_LOADED',
    SYNC_TREES: 'SYNC_TREES',
    GET_FLAGS: 'GET_FLAGS',
    SET_FLAG: 'SET_FLAG',
    RESET_FLAGS: 'RESET_FLAGS',
    GET_SPOTLIGHT_DATA: 'GET_SPOTLIGHT_DATA',
    SPOTLIGHT_BOOTSTRAP: 'SPOTLIGHT_BOOTSTRAP',
    SPOTLIGHT_SEARCH: 'SPOTLIGHT_SEARCH',
    SPOTLIGHT_DISPOSE_SESSION: 'SPOTLIGHT_DISPOSE_SESSION',
    TOGGLE_SPOTLIGHT: 'TOGGLE_SPOTLIGHT',
} as const;

export type RequestType = typeof RPC_METHOD[keyof typeof RPC_METHOD];

// ==== Requests ====
export type RequestMessageBase<T extends string, P = {}> = { type: T } & P;

export type NavigateToMessage = RequestMessageBase<typeof RPC_METHOD.NAVIGATE_TO, {
  url: Url;
  nodeId: NodeId;
}>;
export type PreviewNodeMessage = RequestMessageBase<typeof RPC_METHOD.PREVIEW_NODE, {
  nodeId: NodeId;
}>;
export type SetCurrentMessage = RequestMessageBase<typeof RPC_METHOD.SET_CURRENT, {
  nodeId: NodeId;
}>;
export type TempSelectionSessionId = string;
export type TempSelectionOptions = {
  allowCreateOnCommit?: boolean;
  allowPreviewWithoutTabs?: boolean;
};
export type BeginTempSelectionInput = {
  baseNodeId?: NodeId | null;
  options?: TempSelectionOptions;
};
export type BeginTempSelectionMessage = RequestMessageBase<typeof RPC_METHOD.BEGIN_TEMP_SELECTION, BeginTempSelectionInput>;
export type PreviewTempSelectionMessage = RequestMessageBase<typeof RPC_METHOD.PREVIEW_TEMP_SELECTION, {
  sessionId: TempSelectionSessionId;
  nodeId: NodeId;
  tabId?: TabId;
}>;
export type AcceptTempSelectionMessage = RequestMessageBase<typeof RPC_METHOD.ACCEPT_TEMP_SELECTION, {
  sessionId: TempSelectionSessionId;
  nodeId?: NodeId;
}>;
export type CancelTempSelectionMessage = RequestMessageBase<typeof RPC_METHOD.CANCEL_TEMP_SELECTION, {
  sessionId: TempSelectionSessionId;
  keepSession?: boolean;
}>;
export type EndTempSelectionMessage = RequestMessageBase<typeof RPC_METHOD.END_TEMP_SELECTION, {
  sessionId: TempSelectionSessionId;
}>;
export type OpenPanelMessage = RequestMessageBase<typeof RPC_METHOD.OPEN_PANEL>;

export type UndoMessage = RequestMessageBase<typeof RPC_METHOD.UNDO>
export type RedoMessage = RequestMessageBase<typeof RPC_METHOD.REDO>
export type CommandStateMessage = RequestMessageBase<typeof RPC_METHOD.COMMAND_STATE>
export type GetTagDefsMessage = RequestMessageBase<typeof RPC_METHOD.GET_TAG_DEFS>;
export type UpsertTagDefMessage = RequestMessageBase<typeof RPC_METHOD.UPSERT_TAG_DEF, { tagDef: TagDefinition }>;
export type DeleteTagDefMessage = RequestMessageBase<typeof RPC_METHOD.DELETE_TAG_DEF, { tagId: Tag }>;
export type TabsForNodeMessage = RequestMessageBase<typeof RPC_METHOD.GET_TABS_FOR_NODE, TabsForNodeInput>;
export type SaveSettingsMessage = RequestMessageBase<typeof RPC_METHOD.SAVE_SETTINGS, SaveSettingsInput>;
export type GetSettingsMessage = RequestMessageBase<typeof RPC_METHOD.GET_SETTINGS>;
export type TitleOrFaviconChangedMessage = RequestMessageBase<typeof RPC_METHOD.TITLE_OR_FAVICON_CHANGED, TitleOrFaviconChangedInput>;
export type TreeUpdatedMessage = RequestMessageBase<typeof RPC_METHOD.TREE_UPDATED, TreeUpdatedInput>;
export type TreesUpdatedMessage = RequestMessageBase<typeof RPC_METHOD.TREES_UPDATED, TreesSnapshot>;
export type TagDefsUpdatedInput = { tagDefs: TagDefinition[] };
export type TagsUpdatedMessage = RequestMessageBase<typeof RPC_METHOD.TAGS_UPDATED, TagDefsUpdatedInput>;
export type UiNotificationInput = {
  message: string;
  icon?: string;
  durationMs?: number;
};
export type NotifyMessage = RequestMessageBase<typeof RPC_METHOD.NOTIFY, { notification: UiNotificationInput }>;
export type GetTreeMessage = RequestMessageBase<typeof RPC_METHOD.GET_TREE>;
export type GetTreesMessage = RequestMessageBase<typeof RPC_METHOD.GET_TREES>;
export type ClearTreeMessage = RequestMessageBase<typeof RPC_METHOD.CLEAR_TREE>;
export type NewTreeMessage = RequestMessageBase<typeof RPC_METHOD.NEW_TREE, { label: string }>;
export type OpenTreeMessage = RequestMessageBase<typeof RPC_METHOD.OPEN_TREE, { treeId: string }>;
export type EnsureTreeLoadedMessage = RequestMessageBase<typeof RPC_METHOD.ENSURE_TREE_LOADED, { treeId: string }>;
export type SyncTreesMessage = RequestMessageBase<typeof RPC_METHOD.SYNC_TREES>;
export type RenameTreeMessage = RequestMessageBase<typeof RPC_METHOD.RENAME_TREE, { treeId: string; label: string }>;
export type DeleteArchivedTreeMessage = RequestMessageBase<typeof RPC_METHOD.DELETE_ARCHIVED_TREE, { treeId: string }>;
export type ExportTreeMessage = RequestMessageBase<typeof RPC_METHOD.EXPORT_TREE, { treeId?: string }>;

export type OpenInNewTabMessage = RequestMessageBase<typeof RPC_METHOD.OPEN_IN_NEW_TAB, {
  nodeId: NodeId;
}>;

export type ToggleMuteMessage = RequestMessageBase<typeof RPC_METHOD.TOGGLE_MUTE, { nodeId: NodeId, tabId: TabId }>;
export type CloseTabMessage = RequestMessageBase<typeof RPC_METHOD.CLOSE_TAB, { nodeId: NodeId, tabId: TabId }>;
export type BulkCloseTabsMessage = RequestMessageBase<typeof RPC_METHOD.BULK_CLOSE_TABS, BulkNodeIdsInput>;

export type TogglePinMessage = RequestMessageBase<typeof RPC_METHOD.TOGGLE_PIN, { nodeId: NodeId }>;
export type BulkPinMessage = RequestMessageBase<typeof RPC_METHOD.BULK_PIN, BulkNodeIdsInput>;
export type BulkUnpinMessage = RequestMessageBase<typeof RPC_METHOD.BULK_UNPIN, BulkNodeIdsInput>;

export type AddTagMessage = RequestMessageBase<typeof RPC_METHOD.ADD_TAG, TagMessageInput>;
export type RemoveTagMessage = RequestMessageBase<typeof RPC_METHOD.REMOVE_TAG, TagMessageInput>;

export type NodeLayoutInput = {
  nodeId: NodeId;
  offsetX?: number;
  offsetY?: number;
  radial?: {
    angleDelta: number;
    radiusDelta: number;
  };
};

export type SetNodeLayoutMessage = RequestMessageBase<typeof RPC_METHOD.SET_NODE_LAYOUT, NodeLayoutInput>;
export type SetNodeLayoutBatchMessage = RequestMessageBase<typeof RPC_METHOD.SET_NODE_LAYOUT_BATCH, {
  layouts: NodeLayoutInput[];
}>;
export type ResetNodeLayoutsMessage = RequestMessageBase<typeof RPC_METHOD.RESET_NODE_LAYOUTS>;

export type DeleteNodeMessage = RequestMessageBase<typeof RPC_METHOD.DELETE_NODE, { nodeId: NodeId }>;
export type DeleteChildrenMessage = RequestMessageBase<typeof RPC_METHOD.DELETE_CHILDREN, { nodeId: NodeId }>;
export type DeleteWithChildrenMessage = RequestMessageBase<typeof RPC_METHOD.DELETE_WITH_CHILDREN, { nodeId: NodeId }>;
export type BulkDeleteMessage = RequestMessageBase<typeof RPC_METHOD.BULK_DELETE, BulkNodeIdsInput>;
export type BulkDeleteNodesMessage = RequestMessageBase<typeof RPC_METHOD.BULK_DELETE_NODES, BulkNodeIdsInput>;
export type BulkDeleteRecursiveMessage = RequestMessageBase<typeof RPC_METHOD.BULK_DELETE_RECURSIVE, BulkNodeIdsInput>;

export type EnterEditorModeMessage = RequestMessageBase<typeof RPC_METHOD.ENTER_EDITOR_MODE, { treeId: string }>;
export type ExitEditorModeMessage = RequestMessageBase<typeof RPC_METHOD.EXIT_EDITOR_MODE>;
export type ReparentNodeMessage = RequestMessageBase<typeof RPC_METHOD.REPARENT_NODE, {
  nodeId: NodeId;
  newParentId: NodeId;
}>;
export type DuplicateSubtreeMessage = RequestMessageBase<typeof RPC_METHOD.DUPLICATE_SUBTREE, {
  nodeId: NodeId;
  targetParentId: NodeId;
}>;

export type EditorModeState = {
  active: boolean;
  treeId: string | null;
};

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

export type SyncStatusInput = { status: SyncStatus };
export type SyncStatusUpdatedMessage = RequestMessageBase<typeof RPC_METHOD.SYNC_STATUS_UPDATED, SyncStatusInput>;
export type EditorSyncRetryMessage = RequestMessageBase<typeof RPC_METHOD.EDITOR_SYNC_RETRY>;

export type SiteMessageForwardPayload = {
    siteMessageType: string;
    payload: Record<string, unknown>;
    requestId: string;
};
export type SiteMessageForwardMessage = RequestMessageBase<typeof RPC_METHOD.SITE_MESSAGE_FORWARD, SiteMessageForwardPayload>;

export type SiteMessageForwardResponse = {
    responsePayload?: Record<string, unknown>;
};

export type OAuthInteractiveLoginMessage = RequestMessageBase<
    typeof RPC_METHOD.OAUTH_INTERACTIVE_LOGIN
>;

export type OAuthSilentSyncMessage = RequestMessageBase<
    typeof RPC_METHOD.OAUTH_SILENT_SYNC
>;

export type OAuthInteractiveLoginResponse = {
    ok: boolean;
    reason?: string;
};

export type OAuthSilentSyncResponse = {
    ok: boolean;
    reason?: string;
};

export type SetFlagInput = { key: FlagKey; value: unknown };
export type GetFlagsMessage = RequestMessageBase<typeof RPC_METHOD.GET_FLAGS>;
export type SetFlagMessage = RequestMessageBase<typeof RPC_METHOD.SET_FLAG, SetFlagInput>;
export type ResetFlagsMessage = RequestMessageBase<typeof RPC_METHOD.RESET_FLAGS>;

// ==== Spotlight ====

export type SpotlightSuggestionGroup = 'open-tabs' | 'recently-closed' | 'current-tree' | 'other-trees';
export type SpotlightSearchSessionId = string;

export type SpotlightHighlightRange = {
  start: number;
  end: number;
};

export type SpotlightHighlightMap = {
  title: SpotlightHighlightRange[];
  url: SpotlightHighlightRange[];
};

export type SpotlightSearchResult = {
  nodeId: NodeId;
  title: string;
  url: string;
  favicon?: string | undefined;
  group: SpotlightSuggestionGroup;
  recency: number;
  isCurrent: boolean;
  treeId?: string | undefined;
  treeName?: string | undefined;
  score: number;
  groupBadge: 'Open' | 'Recent' | 'Tree' | 'Archived';
  highlights: SpotlightHighlightMap;
};

export type SpotlightSearchRequest = {
  sessionId: SpotlightSearchSessionId;
  query: string;
  limit: number;
  requestSeq: number;
};

export type SpotlightSearchResponse = {
  requestSeq: number;
  results: SpotlightSearchResult[];
};

export type SpotlightBootstrapData = {
  sessionId: SpotlightSearchSessionId;
  results: SpotlightSearchResult[];
  tree: NavigationTreeJSON;
  currentNodeId: NodeId | null;
  openNodeIds: NodeId[];
  nodeRecency: Record<NodeId, number>;
  nodeTabCounts: Record<NodeId, number>;
  settings: Settings;
};

/** @deprecated Use SPOTLIGHT_BOOTSTRAP instead. */
export type GetSpotlightDataMessage = RequestMessageBase<typeof RPC_METHOD.GET_SPOTLIGHT_DATA>;
export type SpotlightBootstrapMessage = RequestMessageBase<typeof RPC_METHOD.SPOTLIGHT_BOOTSTRAP, {
  limit?: number;
}>;
export type SpotlightSearchMessage = RequestMessageBase<typeof RPC_METHOD.SPOTLIGHT_SEARCH, SpotlightSearchRequest>;
export type SpotlightDisposeSessionMessage = RequestMessageBase<typeof RPC_METHOD.SPOTLIGHT_DISPOSE_SESSION, {
  sessionId: SpotlightSearchSessionId;
}>;
export type ToggleSpotlightMessage = RequestMessageBase<typeof RPC_METHOD.TOGGLE_SPOTLIGHT>;

export type RequestMessage = NavigateToMessage |
    PreviewNodeMessage | SetCurrentMessage |
    BeginTempSelectionMessage | PreviewTempSelectionMessage | AcceptTempSelectionMessage |
    CancelTempSelectionMessage | EndTempSelectionMessage | OpenPanelMessage |
    UndoMessage | RedoMessage |
    CommandStateMessage | GetTagDefsMessage | UpsertTagDefMessage | DeleteTagDefMessage |
    TabsForNodeMessage | SaveSettingsMessage | GetSettingsMessage | TitleOrFaviconChangedMessage |
    TreeUpdatedMessage | TreesUpdatedMessage | TagsUpdatedMessage |
    NotifyMessage |
    GetTreeMessage | GetTreesMessage | ClearTreeMessage | NewTreeMessage | OpenTreeMessage | EnsureTreeLoadedMessage | SyncTreesMessage | RenameTreeMessage | DeleteArchivedTreeMessage | ExportTreeMessage |
    OpenInNewTabMessage | ToggleMuteMessage | CloseTabMessage | BulkCloseTabsMessage |
    TogglePinMessage | BulkPinMessage | BulkUnpinMessage |
    AddTagMessage | RemoveTagMessage |
    DeleteNodeMessage | DeleteChildrenMessage | DeleteWithChildrenMessage |
    BulkDeleteMessage | BulkDeleteNodesMessage | BulkDeleteRecursiveMessage |
    SetNodeLayoutMessage | SetNodeLayoutBatchMessage | ResetNodeLayoutsMessage |
    EnterEditorModeMessage | ExitEditorModeMessage |
    ReparentNodeMessage | DuplicateSubtreeMessage |
    SyncStatusUpdatedMessage | EditorSyncRetryMessage |
    SiteMessageForwardMessage |
    OAuthInteractiveLoginMessage |
    OAuthSilentSyncMessage |
    GetFlagsMessage |
    SetFlagMessage |
    ResetFlagsMessage |
    GetSpotlightDataMessage |
    SpotlightBootstrapMessage |
    SpotlightSearchMessage |
    SpotlightDisposeSessionMessage |
    ToggleSpotlightMessage;


// ==== Responses ====

export type Ok<T = void> = { success: true; data: T };
export type Err = { success: false; error: string };
export type Response<T = void> = Ok<T> | Err;

export function ok<T = void>(data?: T): Response<T> {
    return { success: true, data: data as T };
}

export function err(error: string): Response<never> {
    return { success: false, error };
}

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
    [RPC_METHOD.GET_TAG_DEFS]: TagDefinition[];
    [RPC_METHOD.UPSERT_TAG_DEF]: void;
    [RPC_METHOD.DELETE_TAG_DEF]: void;
    [RPC_METHOD.GET_TABS_FOR_NODE]: TabsForNodeData;
    [RPC_METHOD.SAVE_SETTINGS]: void;
    [RPC_METHOD.GET_SETTINGS]: Settings;
    [RPC_METHOD.TITLE_OR_FAVICON_CHANGED]: void;
    [RPC_METHOD.TREE_UPDATED]: void;
    [RPC_METHOD.TREES_UPDATED]: void;
    [RPC_METHOD.TAGS_UPDATED]: void;
    [RPC_METHOD.NOTIFY]: void;
    [RPC_METHOD.GET_TREE]: TreeUpdatedInput;
    [RPC_METHOD.GET_TREES]: TreesSnapshot;
    [RPC_METHOD.CLEAR_TREE]: void;
    [RPC_METHOD.NEW_TREE]: void;
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
    [RPC_METHOD.ADD_TAG]: void;
    [RPC_METHOD.REMOVE_TAG]: void;
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
    [RPC_METHOD.REPARENT_NODE]: void;
    [RPC_METHOD.DUPLICATE_SUBTREE]: void;
    [RPC_METHOD.SYNC_STATUS_UPDATED]: void;
    [RPC_METHOD.EDITOR_SYNC_RETRY]: void;
    [RPC_METHOD.SITE_MESSAGE_FORWARD]: SiteMessageForwardResponse;
    [RPC_METHOD.OAUTH_INTERACTIVE_LOGIN]: OAuthInteractiveLoginResponse;
    [RPC_METHOD.OAUTH_SILENT_SYNC]: OAuthSilentSyncResponse;
    [RPC_METHOD.ENSURE_TREE_LOADED]: boolean;
    [RPC_METHOD.SYNC_TREES]: void;
    [RPC_METHOD.GET_FLAGS]: ResolvedFlags;
    [RPC_METHOD.SET_FLAG]: ResolvedFlags;
    [RPC_METHOD.RESET_FLAGS]: ResolvedFlags;
    [RPC_METHOD.GET_SPOTLIGHT_DATA]: SpotlightBootstrapData;
    [RPC_METHOD.SPOTLIGHT_BOOTSTRAP]: SpotlightBootstrapData;
    [RPC_METHOD.SPOTLIGHT_SEARCH]: SpotlightSearchResponse;
    [RPC_METHOD.SPOTLIGHT_DISPOSE_SESSION]: void;
    [RPC_METHOD.TOGGLE_SPOTLIGHT]: void;
}

export type ResponseMessage<T extends RequestType> = Response<ResponseDataByType[T]>;

export type MessageByType<T extends RequestType> = Extract<RequestMessage, {type: T}>;

export const rpc = {
    navigateTo(payload: NavigateToData): NavigateToMessage {
        return {
            type: RPC_METHOD.NAVIGATE_TO,
            ...payload,
        }
    },
    previewNode(payload: { nodeId: NodeId }): PreviewNodeMessage { return { type: RPC_METHOD.PREVIEW_NODE, ...payload } },
    setCurrent(payload: { nodeId: NodeId }): SetCurrentMessage { return { type: RPC_METHOD.SET_CURRENT, ...payload } },
    beginTempSelection(payload: BeginTempSelectionInput): BeginTempSelectionMessage {
        return { type: RPC_METHOD.BEGIN_TEMP_SELECTION, ...payload };
    },
    previewTempSelection(payload: { sessionId: TempSelectionSessionId; nodeId: NodeId; tabId?: TabId }): PreviewTempSelectionMessage {
        return { type: RPC_METHOD.PREVIEW_TEMP_SELECTION, ...payload };
    },
    acceptTempSelection(payload: { sessionId: TempSelectionSessionId; nodeId?: NodeId }): AcceptTempSelectionMessage {
        return { type: RPC_METHOD.ACCEPT_TEMP_SELECTION, ...payload };
    },
    cancelTempSelection(payload: { sessionId: TempSelectionSessionId; keepSession?: boolean }): CancelTempSelectionMessage {
        return { type: RPC_METHOD.CANCEL_TEMP_SELECTION, ...payload };
    },
    endTempSelection(payload: { sessionId: TempSelectionSessionId }): EndTempSelectionMessage {
        return { type: RPC_METHOD.END_TEMP_SELECTION, ...payload };
    },
    openPanel(): OpenPanelMessage {
        return { type: RPC_METHOD.OPEN_PANEL };
    },
    getTagDefs(): GetTagDefsMessage { return { type: RPC_METHOD.GET_TAG_DEFS }; },
    upsertTagDef(payload: { tagDef: TagDefinition }): UpsertTagDefMessage { return { type: RPC_METHOD.UPSERT_TAG_DEF, ...payload }; },
    deleteTagDef(payload: { tagId: Tag }): DeleteTagDefMessage { return { type: RPC_METHOD.DELETE_TAG_DEF, ...payload }; },
    undo(): UndoMessage { return { type: RPC_METHOD.UNDO } },
    redo(): RedoMessage { return { type: RPC_METHOD.REDO } },
    getCommandState(): CommandStateMessage { return { type: RPC_METHOD.COMMAND_STATE } },
    getTabsForNode(payload: TabsForNodeInput): TabsForNodeMessage { return { type: RPC_METHOD.GET_TABS_FOR_NODE, ...payload } },
    saveSettings(payload: SaveSettingsInput): SaveSettingsMessage { return { type: RPC_METHOD.SAVE_SETTINGS, ...payload } },
    getSettings(): GetSettingsMessage { return { type: RPC_METHOD.GET_SETTINGS } },
    titleOrFaviconChanged(payload: TitleOrFaviconChangedInput): TitleOrFaviconChangedMessage { return { type: RPC_METHOD.TITLE_OR_FAVICON_CHANGED, ...payload } },
    treeUpdated(payload: TreeUpdatedInput): TreeUpdatedMessage { return { type: RPC_METHOD.TREE_UPDATED, ...payload } },
    treesUpdated(payload: TreesSnapshot): TreesUpdatedMessage { return { type: RPC_METHOD.TREES_UPDATED, ...payload } },
    tagsUpdated(payload: TagDefsUpdatedInput): TagsUpdatedMessage { return { type: RPC_METHOD.TAGS_UPDATED, ...payload } },
    notify(payload: { notification: UiNotificationInput }): NotifyMessage {
        return { type: RPC_METHOD.NOTIFY, ...payload };
    },
    getTree(): GetTreeMessage { return { type: RPC_METHOD.GET_TREE } },
    getTrees(): GetTreesMessage { return { type: RPC_METHOD.GET_TREES } },
    clearTree(): ClearTreeMessage { return { type: RPC_METHOD.CLEAR_TREE } },
    newTree(payload: { label: string }): NewTreeMessage { return { type: RPC_METHOD.NEW_TREE, ...payload } },
    openTree(payload: { treeId: string }): OpenTreeMessage { return { type: RPC_METHOD.OPEN_TREE, ...payload } },
    ensureTreeLoaded(payload: { treeId: string }): EnsureTreeLoadedMessage { return { type: RPC_METHOD.ENSURE_TREE_LOADED, ...payload } },
    syncTrees(): SyncTreesMessage { return { type: RPC_METHOD.SYNC_TREES } },
    renameTree(payload: { treeId: string; label: string }): RenameTreeMessage { return { type: RPC_METHOD.RENAME_TREE, ...payload } },
    deleteArchivedTree(payload: { treeId: string }): DeleteArchivedTreeMessage {
        return { type: RPC_METHOD.DELETE_ARCHIVED_TREE, ...payload };
    },
    exportTree(payload: { treeId?: string }): ExportTreeMessage {
        const msg: Record<string, unknown> = { type: RPC_METHOD.EXPORT_TREE };
        if (payload.treeId !== undefined) msg.treeId = payload.treeId;
        return msg as ExportTreeMessage;
    },
    openInNewTab(payload: { nodeId: NodeId }): OpenInNewTabMessage { return { type: RPC_METHOD.OPEN_IN_NEW_TAB, ...payload } },
    toggleMute(payload: { nodeId: NodeId, tabId: TabId }): ToggleMuteMessage { return { type: RPC_METHOD.TOGGLE_MUTE, ...payload } },
    closeTab(payload: { nodeId: NodeId, tabId: TabId }): CloseTabMessage { return { type: RPC_METHOD.CLOSE_TAB, ...payload } },
    bulkCloseTabs(payload: BulkNodeIdsInput): BulkCloseTabsMessage { return { type: RPC_METHOD.BULK_CLOSE_TABS, ...payload } },
    togglePin(payload: { nodeId: NodeId }): TogglePinMessage { return { type: RPC_METHOD.TOGGLE_PIN, ...payload } },
    bulkPin(payload: BulkNodeIdsInput): BulkPinMessage { return { type: RPC_METHOD.BULK_PIN, ...payload } },
    bulkUnpin(payload: BulkNodeIdsInput): BulkUnpinMessage { return { type: RPC_METHOD.BULK_UNPIN, ...payload } },
    addTag(payload: TagMessageInput): AddTagMessage { return { type: RPC_METHOD.ADD_TAG, ...payload } },
    removeTag(payload: TagMessageInput): RemoveTagMessage { return { type: RPC_METHOD.REMOVE_TAG, ...payload } },
    deleteNode(payload: { nodeId: NodeId }): DeleteNodeMessage { return { type: RPC_METHOD.DELETE_NODE, ...payload } },
    deleteChildren(payload: { nodeId: NodeId }): DeleteChildrenMessage { return { type: RPC_METHOD.DELETE_CHILDREN, ...payload } },
    deleteWithChildren(payload: { nodeId: NodeId }): DeleteWithChildrenMessage { return { type: RPC_METHOD.DELETE_WITH_CHILDREN, ...payload } },
    bulkDelete(payload: BulkNodeIdsInput): BulkDeleteMessage { return { type: RPC_METHOD.BULK_DELETE, ...payload } },
    bulkDeleteNodes(payload: BulkNodeIdsInput): BulkDeleteNodesMessage { return { type: RPC_METHOD.BULK_DELETE_NODES, ...payload } },
    bulkDeleteRecursive(payload: BulkNodeIdsInput): BulkDeleteRecursiveMessage { return { type: RPC_METHOD.BULK_DELETE_RECURSIVE, ...payload } },
    setNodeLayout(payload: {
        nodeId: NodeId;
        offsetX?: number;
        offsetY?: number;
        radial?: { angleDelta: number; radiusDelta: number };
    }): SetNodeLayoutMessage {
        return { type: RPC_METHOD.SET_NODE_LAYOUT, ...payload };
    },
    setNodeLayoutBatch(payload: { layouts: NodeLayoutInput[] }): SetNodeLayoutBatchMessage {
        return { type: RPC_METHOD.SET_NODE_LAYOUT_BATCH, ...payload };
    },
    resetNodeLayouts(): ResetNodeLayoutsMessage {
        return { type: RPC_METHOD.RESET_NODE_LAYOUTS };
    },
    enterEditorMode(payload: { treeId: string }): EnterEditorModeMessage {
        return { type: RPC_METHOD.ENTER_EDITOR_MODE, ...payload };
    },
    exitEditorMode(): ExitEditorModeMessage {
        return { type: RPC_METHOD.EXIT_EDITOR_MODE };
    },
    reparentNode(payload: { nodeId: NodeId; newParentId: NodeId }): ReparentNodeMessage {
        return { type: RPC_METHOD.REPARENT_NODE, ...payload };
    },
    duplicateSubtree(payload: { nodeId: NodeId; targetParentId: NodeId }): DuplicateSubtreeMessage {
        return { type: RPC_METHOD.DUPLICATE_SUBTREE, ...payload };
    },
    syncStatusUpdated(payload: SyncStatusInput): SyncStatusUpdatedMessage {
        return { type: RPC_METHOD.SYNC_STATUS_UPDATED, ...payload };
    },
    editorSyncRetry(): EditorSyncRetryMessage {
        return { type: RPC_METHOD.EDITOR_SYNC_RETRY };
    },
    oauthInteractiveLogin(): OAuthInteractiveLoginMessage {
        return { type: RPC_METHOD.OAUTH_INTERACTIVE_LOGIN };
    },
    oauthSilentSync(): OAuthSilentSyncMessage {
        return { type: RPC_METHOD.OAUTH_SILENT_SYNC };
    },
    getFlags(): GetFlagsMessage {
        return { type: RPC_METHOD.GET_FLAGS };
    },
    setFlag(payload: SetFlagInput): SetFlagMessage {
        return { type: RPC_METHOD.SET_FLAG, ...payload };
    },
    resetFlags(): ResetFlagsMessage {
        return { type: RPC_METHOD.RESET_FLAGS };
    },
    getSpotlightData(): GetSpotlightDataMessage {
        return { type: RPC_METHOD.GET_SPOTLIGHT_DATA };
    },
    spotlightBootstrap(payload?: { limit?: number }): SpotlightBootstrapMessage {
        if (payload?.limit === undefined) {
            return { type: RPC_METHOD.SPOTLIGHT_BOOTSTRAP };
        }
        return { type: RPC_METHOD.SPOTLIGHT_BOOTSTRAP, ...payload };
    },
    spotlightSearch(payload: SpotlightSearchRequest): SpotlightSearchMessage {
        return { type: RPC_METHOD.SPOTLIGHT_SEARCH, ...payload };
    },
    spotlightDisposeSession(payload: { sessionId: SpotlightSearchSessionId }): SpotlightDisposeSessionMessage {
        return { type: RPC_METHOD.SPOTLIGHT_DISPOSE_SESSION, ...payload };
    },
    toggleSpotlight(): ToggleSpotlightMessage {
        return { type: RPC_METHOD.TOGGLE_SPOTLIGHT };
    },
}

// ==== message handler ====

export type MessageHandler<T extends RequestType = RequestType> = (
    message: MessageByType<T>,
    sender: RuntimeMessageSender,
) => Promise<ResponseMessage<T>> | ResponseMessage<T>;

export type HandlerMap = Partial<{ [K in RequestType]: MessageHandler<K>}>;

export function defineRpcHandlers<const H extends HandlerMap>(h: H): H {
    return h;
}

export type StrictHandlerMap = { [K in RequestType]: MessageHandler<K>};

export function defineStrictRpcHandlers<const H extends StrictHandlerMap>(h: H): H {
    return h;
}

// ==== data types ====

export type CommandState = {
    canUndo: boolean;
    canRedo: boolean;
    nextUndoDesc?: Description;
    nextRedoDesc?: Description;
}

export type NavigateToData = {
    url: Url;
    nodeId: NodeId;
}

export type TabsForNodeInput = {
    nodeId: NodeId;
}

export type TabsForNodeData = {
    tabs: Tab[]
}

export type SaveSettingsInput = {
    settings: Settings;
}

export type TitleOrFaviconChangedInput = {
    url: Url;
    favicon?: FaviconUrl;
    title?: Title;
}

export type TreeUpdateReason =
    | 'navigate'
    | 'set-current'
    | 'tree-reset'
    | 'tree-switch'
    | 'layout'
    | 'delete'
    | 'undo'
    | 'pins'
    | 'tags'
    | 'tabs'
    | 'temp-selection'
    | 'sync'
    | 'reparent'
    | 'duplicate'
    | 'editor-enter'
    | 'editor-exit';

export type TreeViewIntentMode = 'force' | 'soft';

export type TreeViewIntent = {
    focusNodeId?: NodeId;
    fitToView?: boolean;
    mode?: TreeViewIntentMode;
    intentId?: number;
};

export type TreeUpdatedInput = {
    tree: NavigationTreeJSON,
    openNodeIds: NodeId[],
    tabStates: Record<NodeId, TabState>,
    nodeTabCounts: Record<NodeId, number>,
    nodeRecency: Record<NodeId, number>,
    reason: TreeUpdateReason,
    view?: TreeViewIntent,
    editorMode?: EditorModeState,
}

export type TreesSnapshot = {
    active: TreeMeta;
    archived: ArchiveIndexEntry[];
};

export type BulkNodeIdsInput = {
    nodeIds: NodeId[];
}

export type TagMessageInput = {
    nodeId: NodeId;
    tagId: Tag;
}
