import {
  RPC_METHOD,
  defineRpcHandlers,
  ok,
  err,
  rpc,
  type SpotlightActionTarget,
  type SpotlightBootstrapData,
  type SpotlightSearchResponse,
} from '@shared/rpc/contracts.js';
import { settingsManager } from '../../services/settings.js';
import { spotlightSearchService } from '../../services/spotlight-search.js';
import { spotlightV3Service } from '../../services/spotlight-v3.js';
import { getFlag } from '../../services/flags.js';
import { navigationHandlers } from './navigation-handlers.js';
import { treeHandlers } from './tree-handlers.js';
import { pinHandlers } from './pin-handlers.js';
import { tabHandlers } from './tab-handlers.js';
import type { RuntimeMessageSender } from '@shared/platform/webext.js';

const EMPTY_SENDER = {} as RuntimeMessageSender;

export const spotlightHandlers = defineRpcHandlers({
  /** @deprecated Use SPOTLIGHT_BOOTSTRAP instead. */
  async [RPC_METHOD.GET_SPOTLIGHT_DATA]() {
    if (getFlag('spotlightV3')) {
      const bootstrap = await spotlightV3Service.bootstrap(80);
      return ok(bootstrap);
    }

    const bootstrap = await spotlightSearchService.bootstrap(80);
    return ok({
      ...bootstrap,
      settings: settingsManager.get(),
    } as unknown as SpotlightBootstrapData);
  },

  async [RPC_METHOD.SPOTLIGHT_BOOTSTRAP](message) {
    if (getFlag('spotlightV3')) {
      const bootstrap = await spotlightV3Service.bootstrap(message.limit ?? 80);
      return ok(bootstrap);
    }

    const bootstrap = await spotlightSearchService.bootstrap(message.limit ?? 80);
    return ok({
      ...bootstrap,
      settings: settingsManager.get(),
    } as unknown as SpotlightBootstrapData);
  },

  async [RPC_METHOD.SPOTLIGHT_SEARCH](message) {
    try {
      if (getFlag('spotlightV3')) {
        const response = await spotlightV3Service.search(
          message.sessionId,
          message.query,
          message.limit,
          message.requestSeq,
        );
        return ok(response);
      }

      const response = spotlightSearchService.search(
        message.sessionId,
        message.query,
        message.limit,
        message.requestSeq,
      );
      return ok(response as unknown as SpotlightSearchResponse);
    } catch (error) {
      if (error instanceof Error && error.message === 'SESSION_EXPIRED') {
        return err('SESSION_EXPIRED');
      }
      return err(error instanceof Error ? error.message : 'SPOTLIGHT_SEARCH_FAILED');
    }
  },

  async [RPC_METHOD.SPOTLIGHT_EXECUTE_ACTION](message) {
    try {
      await spotlightV3Service.recordSelection(message.actionId, message.target, message.query ?? '');

      switch (message.actionId) {
        case 'open':
          return executeWithHandler(
            navigationHandlers[RPC_METHOD.NAVIGATE_TO],
            rpc.navigateTo({
              nodeId: requireNodeTarget(message.target),
              url: '' as never,
            }),
          );
        case 'open-tree':
          return executeWithHandler(
            treeHandlers[RPC_METHOD.OPEN_TREE],
            rpc.openTree({ treeId: requireTreeTarget(message.target) }),
          );
        case 'pin':
        case 'unpin':
          return executeWithHandler(
            pinHandlers[RPC_METHOD.TOGGLE_PIN],
            rpc.togglePin({ nodeId: requireNodeTarget(message.target) }),
          );
        case 'close-tab': {
          const nodeId = requireNodeTarget(message.target);
          return executeWithHandler(
            tabHandlers[RPC_METHOD.BULK_CLOSE_TABS],
            rpc.bulkCloseTabs({ nodeIds: [nodeId] }),
          );
        }
        case 'close-tabs':
          return executeWithHandler(
            tabHandlers[RPC_METHOD.BULK_CLOSE_TABS],
            rpc.bulkCloseTabs({ nodeIds: [requireNodeTarget(message.target)] }),
          );
        case 'archive-current-tree':
          return executeWithHandler(
            treeHandlers[RPC_METHOD.ARCHIVE_ACTIVE_TREE],
            rpc.archiveActiveTree(),
          );
        case 'delete-archived-tree':
          return executeWithHandler(
            treeHandlers[RPC_METHOD.DELETE_ARCHIVED_TREE],
            rpc.deleteArchivedTree({ treeId: requireTreeTarget(message.target) }),
          );
        case 'new-tree':
          return executeWithHandler(
            treeHandlers[RPC_METHOD.NEW_TREE],
            rpc.newTree({ label: 'Untitled Tree' }),
          );
        default:
          return ok({ closeSpotlight: false });
      }
    } catch (error) {
      return err(error instanceof Error ? error.message : 'SPOTLIGHT_EXECUTE_ACTION_FAILED');
    }
  },

  async [RPC_METHOD.SPOTLIGHT_DISPOSE_SESSION](message) {
    if (getFlag('spotlightV3')) {
      spotlightV3Service.dispose(message.sessionId);
      return ok();
    }

    spotlightSearchService.dispose(message.sessionId);
    return ok();
  },

  async [RPC_METHOD.TOGGLE_SPOTLIGHT]() {
    return ok();
  },
});

async function executeWithHandler<TMessage extends { type: string }>(
  handler: ((message: TMessage, sender: RuntimeMessageSender) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string }) | undefined,
  message: TMessage,
) {
  if (!handler) {
    return err(`Missing handler for ${message.type}`);
  }
  const response = await handler(message, EMPTY_SENDER);
  if (!response.success) {
    return err(response.error ?? 'SPOTLIGHT_ACTION_FAILED');
  }
  return ok({ closeSpotlight: true });
}

function requireNodeTarget(target: SpotlightActionTarget | undefined) {
  if (!target || target.kind !== 'node') {
    throw new Error('Node target required');
  }
  return target.nodeId;
}

function requireTreeTarget(target: SpotlightActionTarget | undefined) {
  if (!target || target.kind !== 'tree') {
    throw new Error('Tree target required');
  }
  return target.treeId;
}
