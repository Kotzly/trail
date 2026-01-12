import type { Tag } from '../../shared/types/ids.js';
import type { TagDefinition } from '../../shared/types/tags.js';
import { msg } from '../../shared/types/messages.js';
import { sendMessage } from './background.js';

export async function getTagDefs(): Promise<TagDefinition[]> {
  const response = await sendMessage(msg.getTagDefs());
  if (!response.success) throw new Error(response.error);
  return response.data;
}

export async function upsertTagDef(tagDef: TagDefinition): Promise<void> {
  const response = await sendMessage(msg.upsertTagDef({ tagDef }));
  if (!response.success) throw new Error(response.error);
  return response.data;
}

export async function deleteTagDef(tagId: Tag): Promise<void> {
  const response = await sendMessage(msg.deleteTagDef({ tagId }));
  if (!response.success) throw new Error(response.error);
  return response.data;
}
