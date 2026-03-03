import { rpc } from '@shared/rpc/contracts.js';
import type { FlagKey, ResolvedFlags } from '@shared/types/flags.js';
import { sendMessage } from './background.js';

export async function getFlags(): Promise<ResolvedFlags> {
  const response = await sendMessage(rpc.getFlags());
  if (!response.success) throw new Error(response.error);
  return response.data;
}

export async function setFlag(key: FlagKey, value: unknown): Promise<ResolvedFlags> {
  const response = await sendMessage(rpc.setFlag({ key, value }));
  if (!response.success) throw new Error(response.error);
  return response.data;
}

export async function resetFlags(): Promise<ResolvedFlags> {
  const response = await sendMessage(rpc.resetFlags());
  if (!response.success) throw new Error(response.error);
  return response.data;
}
