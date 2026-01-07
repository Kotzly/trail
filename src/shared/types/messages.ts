import type { Description, NodeId, Url } from "./ids";
import { Settings } from "./settings";

export const MSG = {
    NAVIGATE_TO: 'NAVIGATE_TO',
    UNDO: 'UNDO',
    REDO: 'REDO',
    COMMAND_STATE: 'COMMAND_STATE',
    GET_TABS_FOR_NODE: 'GET_TABS_FOR_NODE',
    SAVE_SETTINGS: 'SAVE_SETTINGS',
    GET_SETTINGS: 'GET_SETTINGS',
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

export type RequestMessage = NavigateToMessage | UndoMessage | RedoMessage | CommandStateMessage | TabsForNodeMessage | SaveSettingsMessage | GetSettingsMessage;


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
}

// ==== message handler ====

export type MessageHandler<T extends RequestType = RequestType> = (
    message: MessageByType<T>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ResponseMessage<T>) => void
) => void | Promise<void>;

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