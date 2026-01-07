import type { NodeId, Url } from "./ids";

export const MSG = {
    NAVIGATE_TO: 'NAVIGATE_TO',
} as const;

export type RequestType = typeof MSG[keyof typeof MSG];

export type RequestMessageBase<T extends string, P = {}> = { type: T } & P;

export type NavigateToMessage = RequestMessageBase<typeof MSG.NAVIGATE_TO, {
  url: Url;
  nodeId: NodeId;
}>;

export type RequestMessage = NavigateToMessage;

export type ResponseMessage = {
  success: boolean;
  error?: string;
};

export type Message = RequestMessage | ResponseMessage;
export type MessageByType<T extends RequestMessage['type']> = Extract<RequestMessage, { type: T }>;


export type MessageHandler<T extends RequestType = RequestType> = (
  message: MessageByType<T>,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: ResponseMessage) => void
) => void | Promise<void>;

export const msg = {
    navigateTo(payload: Omit<NavigateToMessage, 'type'>): NavigateToMessage {
        return {
            type: MSG.NAVIGATE_TO,
            ...payload,
        };
    },
}