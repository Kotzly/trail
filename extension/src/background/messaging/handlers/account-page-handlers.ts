import {
  RPC_METHOD,
  defineRpcHandlers,
  ok,
  err,
  type LocalTrailDetail,
} from '@shared/rpc/contracts.js';
import { treeStorage } from '../../services/tree-storage.js';
import { loadTree } from '../../services/tree-loader.js';
import { NavigationTreeMapper } from '@shared/lib/mapper.js';
import { findBestTrailFavicon } from '@shared/lib/tree-favicon.js';
import { uuidv7 } from '@shared/lib/uuid.js';
import { EXPORT_SCHEMA } from '@shared/types/export.js';
import type { FaviconUrl } from '@shared/types/ids.js';
import { enterEditorMode } from './editor-handlers.js';

export const accountPageHandlers = defineRpcHandlers({
  async [RPC_METHOD.GET_LOCAL_TRAIL_DETAIL](message) {
    const record = await loadTree(message.treeId);
    if (!record) return err('Tree not found');

    const favicon = findBestTrailFavicon(record.tree) ?? record.rootFavicon;

    const detail: LocalTrailDetail = {
      id: record.id,
      label: record.label,
      createdAt: record.createdAt,
      savedAt: record.savedAt,
      nodeCount: record.nodeCount,
      rootUrl: record.rootUrl,
      rootTitle: record.rootTitle,
      rootFavicon: favicon as FaviconUrl | undefined,
      tree: record.tree,
    };

    return ok(detail);
  },

  async [RPC_METHOD.IMPORT_TRAIL](message) {
    const { bundle } = message;

    if (bundle.schema !== EXPORT_SCHEMA) {
      return err(`Unsupported export schema: ${bundle.schema}`);
    }

    if (!bundle.tree) {
      return err('Bundle is missing tree data');
    }

    const treeId = uuidv7();
    const now = Date.now();
    const label = bundle.source?.treeLabel ?? 'Imported Trail';

    let tree;
    try {
      tree = NavigationTreeMapper.fromJSON(bundle.tree);
    } catch {
      return err('Failed to parse tree data from bundle');
    }

    const root = tree.getRoot();
    const treeJSON = NavigationTreeMapper.toJSON(tree);
    const bestFavicon = findBestTrailFavicon(treeJSON) ?? root?.data.favicon;

    const summary = {
      id: treeId,
      label,
      labelSource: 'system' as const,
      labelUpdatedAt: now,
      createdAt: now,
      nodeCount: tree.size(),
      savedAt: now,
      ...(root?.data.url && { rootUrl: root.data.url }),
      ...(root?.data.title && { rootTitle: root.data.title }),
      ...(bestFavicon && { rootFavicon: bestFavicon }),
    };

    const index = await treeStorage.getArchiveIndex();
    const nextIndex = [summary, ...index];
    await treeStorage.setArchiveIndex(nextIndex);
    await treeStorage.saveArchiveTree(treeId, treeJSON);

    return ok({ treeId });
  },

  async [RPC_METHOD.OPEN_FULLVIEW_EDITOR](message) {
    const record = await loadTree(message.treeId);
    if (!record) return err('Tree not found');

    const result = await enterEditorMode(message.treeId);
    if (typeof result === 'string') return err(result);

    return ok(result);
  },
});
