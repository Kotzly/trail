import { z } from "zod";

export const RPC_VERSION = 2 as const;

export const rpcRequestEnvelopeSchema = z.object({
  v: z.literal(RPC_VERSION),
  kind: z.literal("rpc-request"),
  id: z.string().min(1),
  method: z.string().min(1),
  input: z.record(z.string(), z.unknown()).default({}),
});

export const rpcResponseSuccessEnvelopeSchema = z.object({
  v: z.literal(RPC_VERSION),
  kind: z.literal("rpc-response"),
  id: z.string().min(1),
  method: z.string().min(1),
  success: z.literal(true),
  data: z.unknown(),
});

export const rpcResponseErrorEnvelopeSchema = z.object({
  v: z.literal(RPC_VERSION),
  kind: z.literal("rpc-response"),
  id: z.string().min(1),
  method: z.string().min(1),
  success: z.literal(false),
  error: z.string().min(1),
});

export const rpcResponseEnvelopeSchema = z.union([
  rpcResponseSuccessEnvelopeSchema,
  rpcResponseErrorEnvelopeSchema,
]);

export type RpcRequestEnvelope = z.infer<typeof rpcRequestEnvelopeSchema>;
export type RpcResponseEnvelope = z.infer<typeof rpcResponseEnvelopeSchema>;
