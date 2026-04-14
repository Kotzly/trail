import type {
  MessageByType,
  MessageHandler,
  RequestType,
  ResponseDataByType,
} from "@shared/rpc/contracts.js";
import type { RuntimeMessageSender } from "@shared/platform/webext.js";

const EMPTY_SENDER = {} as RuntimeMessageSender;

export async function invokeRpcHandler<T extends RequestType>(
  handler: MessageHandler<T>,
  message: MessageByType<T>,
  sender: RuntimeMessageSender = EMPTY_SENDER,
): Promise<ResponseDataByType[T]> {
  const response = await handler(message, sender);
  if (!response.success) {
    throw new Error(response.error);
  }
  return response.data;
}
