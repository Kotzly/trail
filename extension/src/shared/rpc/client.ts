import { browser } from "@shared/platform/webext.js";
import type { MessageByType, RequestType, ResponseMessage } from "./contracts.js";
import {
  RPC_VERSION,
  rpcRequestEnvelopeSchema,
  rpcResponseEnvelopeSchema,
  type RpcRequestEnvelope,
  type RpcResponseEnvelope,
} from "./schema.js";

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toRpcRequestEnvelope<T extends RequestType>(
  message: MessageByType<T>,
): RpcRequestEnvelope {
  const { type, ...rest } = message as Record<string, unknown> & { type: string };
  return rpcRequestEnvelopeSchema.parse({
    v: RPC_VERSION,
    kind: "rpc-request",
    id: createRequestId(),
    method: type,
    input: rest,
  });
}

function parseRpcResponseEnvelope(raw: unknown): RpcResponseEnvelope {
  const parsed = rpcResponseEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid RPC response envelope");
  }
  return parsed.data;
}

function toResponseMessage<T extends RequestType>(
  request: RpcRequestEnvelope,
  response: RpcResponseEnvelope,
): ResponseMessage<T> {
  if (response.id !== request.id || response.method !== request.method) {
    return {
      success: false,
      error: "Mismatched RPC response envelope",
    };
  }
  if (response.success) {
    return {
      success: true,
      data: response.data,
    } as ResponseMessage<T>;
  }
  return {
    success: false,
    error: response.error,
  };
}

export function sendRpcMessage<T extends RequestType>(
  message: MessageByType<T>,
): Promise<ResponseMessage<T>> {
  const request = toRpcRequestEnvelope(message);
  return browser.runtime.sendMessage(request).then((rawResponse: unknown) => {
    const envelope = parseRpcResponseEnvelope(rawResponse);
    return toResponseMessage<T>(request, envelope);
  });
}

export function fireAndForgetRpcMessage<T extends RequestType>(message: MessageByType<T>): void {
  void sendRpcMessage(message).catch((error) => {
    console.error("Failed to send RPC message:", message.type, error);
  });
}
