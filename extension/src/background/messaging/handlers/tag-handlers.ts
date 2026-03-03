import { RPC_METHOD, defineRpcHandlers } from '@shared/rpc/contracts.js';
import { treeStorage } from '../../services/tree-storage.js';
import { notifyTreeUpdate } from '../notifications.js';
import { CommandManager } from '@shared/lib/commands.js';
import { NavigationTreeMapper } from '@shared/lib/mapper.js';
import type { Description, Tag } from '@shared/types/ids.js';
import { err, ok } from '@shared/rpc/contracts.js';


export const tagHandlers = defineRpcHandlers({
  async [RPC_METHOD.ADD_TAG](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err('Node not found');

    CommandManager.saveSnapshot(NavigationTreeMapper.toJSON(tree), 'Add tag' as Description);
    if (!node.data.tags.includes(message.tagId as Tag)) {
      node.data.tags.push(message.tagId as Tag);
    }
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, 'tags');
    return ok();
  },

  async [RPC_METHOD.REMOVE_TAG](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err('Node not found');

    CommandManager.saveSnapshot(NavigationTreeMapper.toJSON(tree), 'Remove tag' as Description);
    node.data.tags = node.data.tags.filter((t: Tag) => t !== message.tagId);
    treeStorage.cacheTree(tree);
    await notifyTreeUpdate(tree, 'tags');
    return ok();
  },
});
