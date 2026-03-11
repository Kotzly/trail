import { MessageByType, RequestType, ResponseMessage } from "@shared/rpc/contracts.js";
import { sendRpcMessage } from "@shared/rpc/client.js";


export function sendMessage<T extends RequestType>(
    message: MessageByType<T>
): Promise<ResponseMessage<T>> {
    return sendRpcMessage(message);
}

export function fireAndForget<T extends RequestType>(message: MessageByType<T>): void {
    sendMessage(message).catch((error) => {
      console.error('Failed to send RPC message:', message.type, error);
    });
}
