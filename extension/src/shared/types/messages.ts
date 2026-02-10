import type { Description, NodeId, Title, Url, Tag, TabId, FaviconUrl } from "./ids.js";
import { Settings } from "./settings.js";
import { TabState } from "./tabs.js";
import { NavigationTreeJSON, TreeMeta, TreeSummary } from "./tree.js";
import type { TagDefinition } from "./tags.js";

export const MSG = {
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
    RESET_NODE_LAYOUTS: 'RESET_NODE_LAYOUTS',
    ENTER_EDITOR_MODE: 'ENTER_EDITOR_MODE',
    EXIT_EDITOR_MODE: 'EXIT_EDITOR_MODE',
    REPARENT_NODE: 'REPARENT_NODE',
    DUPLICATE_SUBTREE: 'DUPLICATE_SUBTREE',
    SYNC_STATUS_UPDATED: 'SYNC_STATUS_UPDATED',
    EDITOR_SYNC_RETRY: 'EDITOR_SYNC_RETRY',
    SITE_MESSAGE_FORWARD: 'SITE_MESSAGE_FORWARD',
} as const;

export type RequestType = typeof MSG[keyof typeof MSG];

// ==== Requests ====
export type RequestMessageBase<T extends string, P = {}> = { type: T } & P;

export type NavigateToMessage = RequestMessageBase<typeof MSG.NAVIGATE_TO, {
  url: Url;
  nodeId: NodeId;
}>;
export type PreviewNodeMessage = RequestMessageBase<typeof MSG.PREVIEW_NODE, {
  nodeId: NodeId;
}>;
export type SetCurrentMessage = RequestMessageBase<typeof MSG.SET_CURRENT, {
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
export type BeginTempSelectionMessage = RequestMessageBase<typeof MSG.BEGIN_TEMP_SELECTION, BeginTempSelectionInput>;
export type PreviewTempSelectionMessage = RequestMessageBase<typeof MSG.PREVIEW_TEMP_SELECTION, {
  sessionId: TempSelectionSessionId;
  nodeId: NodeId;
  tabId?: TabId;
}>;
export type AcceptTempSelectionMessage = RequestMessageBase<typeof MSG.ACCEPT_TEMP_SELECTION, {
  sessionId: TempSelectionSessionId;
  nodeId?: NodeId;
}>;
export type CancelTempSelectionMessage = RequestMessageBase<typeof MSG.CANCEL_TEMP_SELECTION, {
  sessionId: TempSelectionSessionId;
  keepSession?: boolean;
}>;
export type EndTempSelectionMessage = RequestMessageBase<typeof MSG.END_TEMP_SELECTION, {
  sessionId: TempSelectionSessionId;
}>;
export type OpenPanelMessage = RequestMessageBase<typeof MSG.OPEN_PANEL>;

export type UndoMessage = RequestMessageBase<typeof MSG.UNDO>
export type RedoMessage = RequestMessageBase<typeof MSG.REDO>
export type CommandStateMessage = RequestMessageBase<typeof MSG.COMMAND_STATE>
export type GetTagDefsMessage = RequestMessageBase<typeof MSG.GET_TAG_DEFS>;
export type UpsertTagDefMessage = RequestMessageBase<typeof MSG.UPSERT_TAG_DEF, { tagDef: TagDefinition }>;
export type DeleteTagDefMessage = RequestMessageBase<typeof MSG.DELETE_TAG_DEF, { tagId: Tag }>;
export type TabsForNodeMessage = RequestMessageBase<typeof MSG.GET_TABS_FOR_NODE, TabsForNodeInput>;
export type SaveSettingsMessage = RequestMessageBase<typeof MSG.SAVE_SETTINGS, SaveSettingsInput>;
export type GetSettingsMessage = RequestMessageBase<typeof MSG.GET_SETTINGS>;
export type TitleOrFaviconChangedMessage = RequestMessageBase<typeof MSG.TITLE_OR_FAVICON_CHANGED, TitleOrFaviconChangedInput>;
export type TreeUpdatedMessage = RequestMessageBase<typeof MSG.TREE_UPDATED, TreeUpdatedInput>;
export type TreesUpdatedMessage = RequestMessageBase<typeof MSG.TREES_UPDATED, TreesSnapshot>;
export type TagDefsUpdatedInput = { tagDefs: TagDefinition[] };
export type TagsUpdatedMessage = RequestMessageBase<typeof MSG.TAGS_UPDATED, TagDefsUpdatedInput>;
export type UiNotificationInput = {
  message: string;
  icon?: string;
  durationMs?: number;
};
export type NotifyMessage = RequestMessageBase<typeof MSG.NOTIFY, { notification: UiNotificationInput }>;
export type GetTreeMessage = RequestMessageBase<typeof MSG.GET_TREE>;
export type GetTreesMessage = RequestMessageBase<typeof MSG.GET_TREES>;
export type ClearTreeMessage = RequestMessageBase<typeof MSG.CLEAR_TREE>;
export type NewTreeMessage = RequestMessageBase<typeof MSG.NEW_TREE, { label: string }>;
export type OpenTreeMessage = RequestMessageBase<typeof MSG.OPEN_TREE, { treeId: string }>;
export type RenameTreeMessage = RequestMessageBase<typeof MSG.RENAME_TREE, { treeId: string; label: string }>;
export type DeleteArchivedTreeMessage = RequestMessageBase<typeof MSG.DELETE_ARCHIVED_TREE, { treeId: string }>;

export type OpenInNewTabMessage = RequestMessageBase<typeof MSG.OPEN_IN_NEW_TAB, {
  nodeId: NodeId;
}>;

export type ToggleMuteMessage = RequestMessageBase<typeof MSG.TOGGLE_MUTE, { nodeId: NodeId, tabId: TabId }>;
export type CloseTabMessage = RequestMessageBase<typeof MSG.CLOSE_TAB, { nodeId: NodeId, tabId: TabId }>;
export type BulkCloseTabsMessage = RequestMessageBase<typeof MSG.BULK_CLOSE_TABS, BulkNodeIdsInput>;

export type TogglePinMessage = RequestMessageBase<typeof MSG.TOGGLE_PIN, { nodeId: NodeId }>;
export type BulkPinMessage = RequestMessageBase<typeof MSG.BULK_PIN, BulkNodeIdsInput>;
export type BulkUnpinMessage = RequestMessageBase<typeof MSG.BULK_UNPIN, BulkNodeIdsInput>;

export type AddTagMessage = RequestMessageBase<typeof MSG.ADD_TAG, TagMessageInput>;
export type RemoveTagMessage = RequestMessageBase<typeof MSG.REMOVE_TAG, TagMessageInput>;

export type SetNodeLayoutMessage = RequestMessageBase<typeof MSG.SET_NODE_LAYOUT, {
  nodeId: NodeId;
  offsetX?: number;
  offsetY?: number;
  radial?: {
    angleDelta: number;
    radiusDelta: number;
  };
}>;
export type ResetNodeLayoutsMessage = RequestMessageBase<typeof MSG.RESET_NODE_LAYOUTS>;

export type DeleteNodeMessage = RequestMessageBase<typeof MSG.DELETE_NODE, { nodeId: NodeId }>;
export type DeleteChildrenMessage = RequestMessageBase<typeof MSG.DELETE_CHILDREN, { nodeId: NodeId }>;
export type DeleteWithChildrenMessage = RequestMessageBase<typeof MSG.DELETE_WITH_CHILDREN, { nodeId: NodeId }>;
export type BulkDeleteMessage = RequestMessageBase<typeof MSG.BULK_DELETE, BulkNodeIdsInput>;
export type BulkDeleteNodesMessage = RequestMessageBase<typeof MSG.BULK_DELETE_NODES, BulkNodeIdsInput>;
export type BulkDeleteRecursiveMessage = RequestMessageBase<typeof MSG.BULK_DELETE_RECURSIVE, BulkNodeIdsInput>;

export type EnterEditorModeMessage = RequestMessageBase<typeof MSG.ENTER_EDITOR_MODE, { treeId: string }>;
export type ExitEditorModeMessage = RequestMessageBase<typeof MSG.EXIT_EDITOR_MODE>;
export type ReparentNodeMessage = RequestMessageBase<typeof MSG.REPARENT_NODE, {
  nodeId: NodeId;
  newParentId: NodeId;
}>;
export type DuplicateSubtreeMessage = RequestMessageBase<typeof MSG.DUPLICATE_SUBTREE, {
  nodeId: NodeId;
}>;

export type EditorModeState = {
  active: boolean;
  treeId: string | null;
};

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

export type SyncStatusInput = { status: SyncStatus };
export type SyncStatusUpdatedMessage = RequestMessageBase<typeof MSG.SYNC_STATUS_UPDATED, SyncStatusInput>;
export type EditorSyncRetryMessage = RequestMessageBase<typeof MSG.EDITOR_SYNC_RETRY>;

export type SiteMessageForwardPayload = {
    siteMessageType: string;
    payload: Record<string, unknown>;
    requestId: string;
};
export type SiteMessageForwardMessage = RequestMessageBase<typeof MSG.SITE_MESSAGE_FORWARD, SiteMessageForwardPayload>;

export type SiteMessageForwardResponse = {
    responsePayload?: Record<string, unknown>;
};

export type RequestMessage = NavigateToMessage |
    PreviewNodeMessage | SetCurrentMessage |
    BeginTempSelectionMessage | PreviewTempSelectionMessage | AcceptTempSelectionMessage |
    CancelTempSelectionMessage | EndTempSelectionMessage | OpenPanelMessage |
    UndoMessage | RedoMessage |
    CommandStateMessage | GetTagDefsMessage | UpsertTagDefMessage | DeleteTagDefMessage |
    TabsForNodeMessage | SaveSettingsMessage | GetSettingsMessage | TitleOrFaviconChangedMessage |
    TreeUpdatedMessage | TreesUpdatedMessage | TagsUpdatedMessage |
    NotifyMessage |
    GetTreeMessage | GetTreesMessage | ClearTreeMessage | NewTreeMessage | OpenTreeMessage | RenameTreeMessage | DeleteArchivedTreeMessage |
    OpenInNewTabMessage | ToggleMuteMessage | CloseTabMessage | BulkCloseTabsMessage |
    TogglePinMessage | BulkPinMessage | BulkUnpinMessage |
    AddTagMessage | RemoveTagMessage |
    DeleteNodeMessage | DeleteChildrenMessage | DeleteWithChildrenMessage |
    BulkDeleteMessage | BulkDeleteNodesMessage | BulkDeleteRecursiveMessage |
    SetNodeLayoutMessage | ResetNodeLayoutsMessage |
    EnterEditorModeMessage | ExitEditorModeMessage |
    ReparentNodeMessage | DuplicateSubtreeMessage |
    SyncStatusUpdatedMessage | EditorSyncRetryMessage |
    SiteMessageForwardMessage;


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
    [MSG.NAVIGATE_TO]: void;
    [MSG.PREVIEW_NODE]: void;
    [MSG.SET_CURRENT]: void;
    [MSG.BEGIN_TEMP_SELECTION]: { sessionId: TempSelectionSessionId };
    [MSG.PREVIEW_TEMP_SELECTION]: { previewedTabId: TabId | null };
    [MSG.ACCEPT_TEMP_SELECTION]: void;
    [MSG.CANCEL_TEMP_SELECTION]: void;
    [MSG.END_TEMP_SELECTION]: void;
    [MSG.OPEN_PANEL]: void;
    [MSG.UNDO]: CommandState;
    [MSG.REDO]: CommandState;
    [MSG.COMMAND_STATE]: CommandState;
    [MSG.GET_TAG_DEFS]: TagDefinition[];
    [MSG.UPSERT_TAG_DEF]: void;
    [MSG.DELETE_TAG_DEF]: void;
    [MSG.GET_TABS_FOR_NODE]: TabsForNodeData;
    [MSG.SAVE_SETTINGS]: void;
    [MSG.GET_SETTINGS]: Settings;
    [MSG.TITLE_OR_FAVICON_CHANGED]: void;
    [MSG.TREE_UPDATED]: void;
    [MSG.TREES_UPDATED]: void;
    [MSG.TAGS_UPDATED]: void;
    [MSG.NOTIFY]: void;
    [MSG.GET_TREE]: TreeUpdatedInput;
    [MSG.GET_TREES]: TreesSnapshot;
    [MSG.CLEAR_TREE]: void;
    [MSG.NEW_TREE]: void;
    [MSG.OPEN_TREE]: void;
    [MSG.RENAME_TREE]: void;
    [MSG.DELETE_ARCHIVED_TREE]: void;
    [MSG.OPEN_IN_NEW_TAB]: void;
    [MSG.TOGGLE_MUTE]: void;
    [MSG.CLOSE_TAB]: void;
    [MSG.BULK_CLOSE_TABS]: void;
    [MSG.TOGGLE_PIN]: void;
    [MSG.BULK_PIN]: void;
    [MSG.BULK_UNPIN]: void;
    [MSG.ADD_TAG]: void;
    [MSG.REMOVE_TAG]: void;
    [MSG.DELETE_NODE]: void;
    [MSG.DELETE_CHILDREN]: void;
    [MSG.DELETE_WITH_CHILDREN]: void;
    [MSG.BULK_DELETE]: void;
    [MSG.BULK_DELETE_NODES]: void;
    [MSG.BULK_DELETE_RECURSIVE]: void;
    [MSG.SET_NODE_LAYOUT]: void;
    [MSG.RESET_NODE_LAYOUTS]: void;
    [MSG.ENTER_EDITOR_MODE]: EditorModeState;
    [MSG.EXIT_EDITOR_MODE]: EditorModeState;
    [MSG.REPARENT_NODE]: void;
    [MSG.DUPLICATE_SUBTREE]: void;
    [MSG.SYNC_STATUS_UPDATED]: void;
    [MSG.EDITOR_SYNC_RETRY]: void;
    [MSG.SITE_MESSAGE_FORWARD]: SiteMessageForwardResponse;
}

export type ResponseMessage<T extends RequestType> = Response<ResponseDataByType[T]>;

export type MessageByType<T extends RequestType> = Extract<RequestMessage, {type: T}>;

export const msg = {
    navigateTo(payload: NavigateToData): NavigateToMessage {
        return {
            type: MSG.NAVIGATE_TO,
            ...payload,
        }
    },
    previewNode(payload: { nodeId: NodeId }): PreviewNodeMessage { return { type: MSG.PREVIEW_NODE, ...payload } },
    setCurrent(payload: { nodeId: NodeId }): SetCurrentMessage { return { type: MSG.SET_CURRENT, ...payload } },
    beginTempSelection(payload: BeginTempSelectionInput): BeginTempSelectionMessage {
        return { type: MSG.BEGIN_TEMP_SELECTION, ...payload };
    },
    previewTempSelection(payload: { sessionId: TempSelectionSessionId; nodeId: NodeId; tabId?: TabId }): PreviewTempSelectionMessage {
        return { type: MSG.PREVIEW_TEMP_SELECTION, ...payload };
    },
    acceptTempSelection(payload: { sessionId: TempSelectionSessionId; nodeId?: NodeId }): AcceptTempSelectionMessage {
        return { type: MSG.ACCEPT_TEMP_SELECTION, ...payload };
    },
    cancelTempSelection(payload: { sessionId: TempSelectionSessionId; keepSession?: boolean }): CancelTempSelectionMessage {
        return { type: MSG.CANCEL_TEMP_SELECTION, ...payload };
    },
    endTempSelection(payload: { sessionId: TempSelectionSessionId }): EndTempSelectionMessage {
        return { type: MSG.END_TEMP_SELECTION, ...payload };
    },
    openPanel(): OpenPanelMessage {
        return { type: MSG.OPEN_PANEL };
    },
    getTagDefs(): GetTagDefsMessage { return { type: MSG.GET_TAG_DEFS }; },
    upsertTagDef(payload: { tagDef: TagDefinition }): UpsertTagDefMessage { return { type: MSG.UPSERT_TAG_DEF, ...payload }; },
    deleteTagDef(payload: { tagId: Tag }): DeleteTagDefMessage { return { type: MSG.DELETE_TAG_DEF, ...payload }; },
    undo(): UndoMessage { return { type: MSG.UNDO } },
    redo(): RedoMessage { return { type: MSG.REDO } },
    getCommandState(): CommandStateMessage { return { type: MSG.COMMAND_STATE } },
    getTabsForNode(payload: TabsForNodeInput): TabsForNodeMessage { return { type: MSG.GET_TABS_FOR_NODE, ...payload } },
    saveSettings(payload: SaveSettingsInput): SaveSettingsMessage { return { type: MSG.SAVE_SETTINGS, ...payload } },
    getSettings(): GetSettingsMessage { return { type: MSG.GET_SETTINGS } },
    titleOrFaviconChanged(payload: TitleOrFaviconChangedInput): TitleOrFaviconChangedMessage { return { type: MSG.TITLE_OR_FAVICON_CHANGED, ...payload } },
    treeUpdated(payload: TreeUpdatedInput): TreeUpdatedMessage { return { type: MSG.TREE_UPDATED, ...payload } },
    treesUpdated(payload: TreesSnapshot): TreesUpdatedMessage { return { type: MSG.TREES_UPDATED, ...payload } },
    tagsUpdated(payload: TagDefsUpdatedInput): TagsUpdatedMessage { return { type: MSG.TAGS_UPDATED, ...payload } },
    notify(payload: { notification: UiNotificationInput }): NotifyMessage {
        return { type: MSG.NOTIFY, ...payload };
    },
    getTree(): GetTreeMessage { return { type: MSG.GET_TREE } },
    getTrees(): GetTreesMessage { return { type: MSG.GET_TREES } },
    clearTree(): ClearTreeMessage { return { type: MSG.CLEAR_TREE } },
    newTree(payload: { label: string }): NewTreeMessage { return { type: MSG.NEW_TREE, ...payload } },
    openTree(payload: { treeId: string }): OpenTreeMessage { return { type: MSG.OPEN_TREE, ...payload } },
    renameTree(payload: { treeId: string; label: string }): RenameTreeMessage { return { type: MSG.RENAME_TREE, ...payload } },
    deleteArchivedTree(payload: { treeId: string }): DeleteArchivedTreeMessage {
        return { type: MSG.DELETE_ARCHIVED_TREE, ...payload };
    },
    openInNewTab(payload: { nodeId: NodeId }): OpenInNewTabMessage { return { type: MSG.OPEN_IN_NEW_TAB, ...payload } },
    toggleMute(payload: { nodeId: NodeId, tabId: TabId }): ToggleMuteMessage { return { type: MSG.TOGGLE_MUTE, ...payload } },
    closeTab(payload: { nodeId: NodeId, tabId: TabId }): CloseTabMessage { return { type: MSG.CLOSE_TAB, ...payload } },
    bulkCloseTabs(payload: BulkNodeIdsInput): BulkCloseTabsMessage { return { type: MSG.BULK_CLOSE_TABS, ...payload } },
    togglePin(payload: { nodeId: NodeId }): TogglePinMessage { return { type: MSG.TOGGLE_PIN, ...payload } },
    bulkPin(payload: BulkNodeIdsInput): BulkPinMessage { return { type: MSG.BULK_PIN, ...payload } },
    bulkUnpin(payload: BulkNodeIdsInput): BulkUnpinMessage { return { type: MSG.BULK_UNPIN, ...payload } },
    addTag(payload: TagMessageInput): AddTagMessage { return { type: MSG.ADD_TAG, ...payload } },
    removeTag(payload: TagMessageInput): RemoveTagMessage { return { type: MSG.REMOVE_TAG, ...payload } },
    deleteNode(payload: { nodeId: NodeId }): DeleteNodeMessage { return { type: MSG.DELETE_NODE, ...payload } },
    deleteChildren(payload: { nodeId: NodeId }): DeleteChildrenMessage { return { type: MSG.DELETE_CHILDREN, ...payload } },
    deleteWithChildren(payload: { nodeId: NodeId }): DeleteWithChildrenMessage { return { type: MSG.DELETE_WITH_CHILDREN, ...payload } },
    bulkDelete(payload: BulkNodeIdsInput): BulkDeleteMessage { return { type: MSG.BULK_DELETE, ...payload } },
    bulkDeleteNodes(payload: BulkNodeIdsInput): BulkDeleteNodesMessage { return { type: MSG.BULK_DELETE_NODES, ...payload } },
    bulkDeleteRecursive(payload: BulkNodeIdsInput): BulkDeleteRecursiveMessage { return { type: MSG.BULK_DELETE_RECURSIVE, ...payload } },
    setNodeLayout(payload: {
        nodeId: NodeId;
        offsetX?: number;
        offsetY?: number;
        radial?: { angleDelta: number; radiusDelta: number };
    }): SetNodeLayoutMessage {
        return { type: MSG.SET_NODE_LAYOUT, ...payload };
    },
    resetNodeLayouts(): ResetNodeLayoutsMessage {
        return { type: MSG.RESET_NODE_LAYOUTS };
    },
    enterEditorMode(payload: { treeId: string }): EnterEditorModeMessage {
        return { type: MSG.ENTER_EDITOR_MODE, ...payload };
    },
    exitEditorMode(): ExitEditorModeMessage {
        return { type: MSG.EXIT_EDITOR_MODE };
    },
    reparentNode(payload: { nodeId: NodeId; newParentId: NodeId }): ReparentNodeMessage {
        return { type: MSG.REPARENT_NODE, ...payload };
    },
    duplicateSubtree(payload: { nodeId: NodeId }): DuplicateSubtreeMessage {
        return { type: MSG.DUPLICATE_SUBTREE, ...payload };
    },
    syncStatusUpdated(payload: SyncStatusInput): SyncStatusUpdatedMessage {
        return { type: MSG.SYNC_STATUS_UPDATED, ...payload };
    },
    editorSyncRetry(): EditorSyncRetryMessage {
        return { type: MSG.EDITOR_SYNC_RETRY };
    },
}

// ==== message handler ====

export type MessageHandler<T extends RequestType = RequestType> = (
    message: MessageByType<T>,
    sender: chrome.runtime.MessageSender,
) => Promise<ResponseMessage<T>> | ResponseMessage<T>;

export type HandlerMap = Partial<{ [K in RequestType]: MessageHandler<K>}>;

export function defineHandlers<const H extends HandlerMap>(h: H): H {
    return h;
}

export type StrictHandlerMap = { [K in RequestType]: MessageHandler<K>};

export function defineStrictHandlers<const H extends StrictHandlerMap>(h: H): H {
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
    tabs: chrome.tabs.Tab[]
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
    reason: TreeUpdateReason,
    view?: TreeViewIntent,
    editorMode?: EditorModeState,
}

export type TreesSnapshot = {
    active: TreeMeta;
    archived: TreeSummary[];
};

export type BulkNodeIdsInput = {
    nodeIds: NodeId[];
}

export type TagMessageInput = {
    nodeId: NodeId;
    tagId: Tag;
}
