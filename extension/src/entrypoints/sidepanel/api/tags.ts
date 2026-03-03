import type { Tag } from '../../../shared/types/ids.js';
import type { TagDefinition } from '../../../shared/types/tags.js';
import { rpc } from '../../../shared/rpc/contracts.js';
import { sendMessage } from './background.js';

export async function getTagDefs(): Promise<TagDefinition[]> {
  const response = await sendMessage(rpc.getTagDefs());
  if (!response.success) throw new Error(response.error);
  return response.data;
}

export async function upsertTagDef(tagDef: TagDefinition): Promise<void> {
  const response = await sendMessage(rpc.upsertTagDef({ tagDef }));
  if (!response.success) throw new Error(response.error);
  return response.data;
}

export async function deleteTagDef(tagId: Tag): Promise<void> {
  const response = await sendMessage(rpc.deleteTagDef({ tagId }));
  if (!response.success) throw new Error(response.error);
  return response.data;
}
