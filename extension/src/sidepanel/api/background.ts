import { MessageByType, RequestType, ResponseMessage } from "../../shared/types/messages.js";


export function sendMessage<T extends RequestType>(
    message: MessageByType<T>
): Promise<ResponseMessage<T>> {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response: ResponseMessage<T>) => {
            const err = chrome.runtime.lastError;
            if (err) return reject(err);
            resolve(response);
        });
    });
}

export function fireAndForget<T extends RequestType>(message: MessageByType<T>): void {
    sendMessage(message).catch((error) => {
      console.error('Failed to send message:', message.type, error);
    });
}