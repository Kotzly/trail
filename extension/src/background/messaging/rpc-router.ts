import type {
  RequestMessage,
  RequestType,
  ResponseMessage,
} from "../../shared/rpc/contracts.js";
import {
  RPC_VERSION,
  rpcRequestEnvelopeSchema,
  rpcResponseEnvelopeSchema,
  type RpcRequestEnvelope,
  type RpcResponseEnvelope,
} from "../../shared/rpc/schema.js";

export function parseRpcRequestEnvelope(
  raw: unknown,
): RpcRequestEnvelope | null {
  const parsed = rpcRequestEnvelopeSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data;
}

export function toRequestMessage(
  envelope: RpcRequestEnvelope,
): RequestMessage {
  return {
    type: envelope.method as RequestType,
    ...envelope.input,
  } as RequestMessage;
}

export function toRpcResponseEnvelope(
  request: RpcRequestEnvelope,
  response: ResponseMessage<RequestType>,
): RpcResponseEnvelope {
  const payload: RpcResponseEnvelope = response.success
    ? {
        v: RPC_VERSION,
        kind: "rpc-response",
        id: request.id,
        method: request.method,
        success: true,
        data: response.data,
      }
    : {
        v: RPC_VERSION,
        kind: "rpc-response",
        id: request.id,
        method: request.method,
        success: false,
        error: response.error,
      };
  return rpcResponseEnvelopeSchema.parse(payload);
}

export function createRpcErrorEnvelope(
  request: Pick<RpcRequestEnvelope, "id" | "method">,
  error: string,
): RpcResponseEnvelope {
  return rpcResponseEnvelopeSchema.parse({
    v: RPC_VERSION,
    kind: "rpc-response",
    id: request.id,
    method: request.method,
    success: false,
    error,
  });
}
