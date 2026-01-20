import { MSG, defineHandlers, err, ok } from '../../../shared/types/messages.js';
import type { Tag } from '../../../shared/types/ids.js';
import type { TagDefinition } from '../../../shared/types/tags.js';
import { tagStorage } from '../../services/tag-storage.js';
import { treeStorage } from '../../services/tree-storage.js';
import { notifyTreeUpdate } from '../notifications.js';
import { msg } from '../../../shared/types/messages.js';
import { sendRuntimeMessage } from '../send-message.js';

async function broadcastTagDefs(defs?: TagDefinition[]): Promise<void> {
  const tagDefs = defs ?? (await tagStorage.getAll());
  sendRuntimeMessage(msg.tagsUpdated({ tagDefs }));
}

async function removeTagFromTree(tagId: Tag): Promise<boolean> {
  const tree = await treeStorage.getOrCreateTree();
  let changed = false;
  for (const node of tree.iter()) {
    if (!node.data.tags?.includes(tagId)) continue;
    node.data.tags = node.data.tags.filter((t) => t !== tagId);
    changed = true;
  }
  if (changed) {
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, 'tags');
  }
  return changed;
}

export const tagDefHandlers = defineHandlers({
  async [MSG.GET_TAG_DEFS]() {
    const defs = await tagStorage.getAll();
    return ok(defs);
  },

  async [MSG.UPSERT_TAG_DEF](message) {
    const tagDef = message.tagDef as TagDefinition;
    if (!tagDef?.id) return err('Tag id is required');
    if (!tagDef.label || tagDef.label.trim().length === 0) return err('Tag label is required');
    if (tagDef.label.trim().length > 20) return err('Tag label must be 20 chars or less');
    await tagStorage.upsert({ ...tagDef, label: tagDef.label.trim() });
    await broadcastTagDefs();
    return ok();
  },

  async [MSG.DELETE_TAG_DEF](message) {
    await tagStorage.delete(message.tagId as Tag);
    await removeTagFromTree(message.tagId as Tag);
    await broadcastTagDefs();
    return ok();
  },
});
