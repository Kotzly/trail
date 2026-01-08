import type { Description, NodeId, Title, Url } from "./ids";
import { Settings } from "./settings";
import { TabState } from "./tabs";
import { NavigationTreeJSON } from "./tree";

export const MSG = {
    NAVIGATE_TO: 'NAVIGATE_TO',
    UNDO: 'UNDO',
    REDO: 'REDO',
    COMMAND_STATE: 'COMMAND_STATE',
    GET_TABS_FOR_NODE: 'GET_TABS_FOR_NODE',
    SAVE_SETTINGS: 'SAVE_SETTINGS',
    GET_SETTINGS: 'GET_SETTINGS',
    TITLE_CHANGED: 'TITLE_CHANGED',
    TREE_UPDATED: 'TREE_UPDATED',
} as const;

export type RequestType = typeof MSG[keyof typeof MSG];

// ==== Requests ====
export type RequestMessageBase<T extends string, P = {}> = { type: T } & P;

export type NavigateToMessage = RequestMessageBase<typeof MSG.NAVIGATE_TO, {
  url: Url;
  nodeId: NodeId;
}>;

export type UndoMessage = RequestMessageBase<typeof MSG.UNDO>
export type RedoMessage = RequestMessageBase<typeof MSG.REDO>
export type CommandStateMessage = RequestMessageBase<typeof MSG.COMMAND_STATE>
export type TabsForNodeMessage = RequestMessageBase<typeof MSG.GET_TABS_FOR_NODE, TabsForNodeInput>;
export type SaveSettingsMessage = RequestMessageBase<typeof MSG.SAVE_SETTINGS, SaveSettingsInput>;
export type GetSettingsMessage = RequestMessageBase<typeof MSG.GET_SETTINGS>;
export type TitleChangedMessage = RequestMessageBase<typeof MSG.TITLE_CHANGED, TitleChangedInput>;
export type TreeUpdatedMessage = RequestMessageBase<typeof MSG.TREE_UPDATED, TreeUpdatedInput>;
export type RequestMessage = NavigateToMessage | 
    UndoMessage | RedoMessage | 
    CommandStateMessage | TabsForNodeMessage | SaveSettingsMessage | GetSettingsMessage | TitleChangedMessage | TreeUpdatedMessage;


// ==== Responses ====

export type Ok<T = void> = { success: true; data: T };
export type Err = { success: false; error: string };
export type Response<T = void> = Ok<T> | Err;

export type ResponseDataByType = {
    [MSG.NAVIGATE_TO]: NavigateToData;
    [MSG.UNDO]: CommandState;
    [MSG.REDO]: CommandState;
    [MSG.COMMAND_STATE]: CommandState;
    [MSG.GET_TABS_FOR_NODE]: TabsForNodeData;
    [MSG.SAVE_SETTINGS]: void;
    [MSG.GET_SETTINGS]: Settings;
    [MSG.TITLE_CHANGED]: void;
    [MSG.TREE_UPDATED]: void;
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
    undo(): UndoMessage { return { type: MSG.UNDO } },
    redo(): RedoMessage { return { type: MSG.REDO } },
    getCommandState(): CommandStateMessage { return { type: MSG.COMMAND_STATE } },
    getTabsForNode(payload: TabsForNodeInput): TabsForNodeMessage { return { type: MSG.GET_TABS_FOR_NODE, ...payload } },
    saveSettings(payload: SaveSettingsInput): SaveSettingsMessage { return { type: MSG.SAVE_SETTINGS, ...payload } },
    getSettings(): GetSettingsMessage { return { type: MSG.GET_SETTINGS } },
    titleChanged(url: Url, title: Title): TitleChangedMessage { return { type: MSG.TITLE_CHANGED, url, title } },
    treeUpdated(payload: TreeUpdatedInput): TreeUpdatedMessage { return { type: MSG.TREE_UPDATED, ...payload } },
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

export type TitleChangedInput = {
    url: Url;
    title: Title;
}

export type TreeUpdatedInput = {
    tree: NavigationTreeJSON,
    openNodeIds: NodeId[],
    tabStates: Record<NodeId, TabState>,
    nodeTabCounts: Record<NodeId, number>,
}