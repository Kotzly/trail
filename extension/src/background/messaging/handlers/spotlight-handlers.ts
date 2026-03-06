import {
  RPC_METHOD,
  defineRpcHandlers,
  ok,
  err,
  rpc,
  type SpotlightActionTarget,
  type SpotlightBootstrapData,
  type SpotlightGraphPreviewData,
  type SpotlightSearchResponse,
} from '@shared/rpc/contracts.js';
import { settingsManager } from '../../services/settings.js';
import { spotlightService } from '../../services/spotlight.js';
import { navigationHandlers } from './navigation-handlers.js';
import { openTreeAndFocusNode, treeHandlers } from './tree-handlers.js';
import { pinHandlers } from './pin-handlers.js';
import { tabHandlers } from './tab-handlers.js';
import { browser, type RuntimeMessageSender } from '@shared/platform/webext.js';

const EMPTY_SENDER = {} as RuntimeMessageSender;

export const spotlightHandlers = defineRpcHandlers({
  /** @deprecated Use SPOTLIGHT_BOOTSTRAP instead. */
  async [RPC_METHOD.GET_SPOTLIGHT_DATA]() {
    const bootstrap = await spotlightService.bootstrap(80);
    return ok({
      ...bootstrap,
      settings: settingsManager.get(),
    } as unknown as SpotlightBootstrapData);
  },

  async [RPC_METHOD.SPOTLIGHT_BOOTSTRAP](message) {
    const bootstrap = await spotlightService.bootstrap(message.limit ?? 80);
    return ok({
      ...bootstrap,
      settings: settingsManager.get(),
    } as unknown as SpotlightBootstrapData);
  },

  async [RPC_METHOD.SPOTLIGHT_SEARCH](message) {
    try {
      const response = await spotlightService.search(
        message.sessionId,
        message.query,
        message.limit,
        message.requestSeq,
      );
      return ok(response as SpotlightSearchResponse);
    } catch (error) {
      if (error instanceof Error && error.message === 'SESSION_EXPIRED') {
        return err('SESSION_EXPIRED');
      }
      return err(error instanceof Error ? error.message : 'SPOTLIGHT_SEARCH_FAILED');
    }
  },

  async [RPC_METHOD.SPOTLIGHT_GET_TREE_PREVIEW](message) {
    try {
      const preview = await spotlightService.getTreePreview(message.treeId);
      return ok(preview);
    } catch (error) {
      return err(error instanceof Error ? error.message : 'SPOTLIGHT_GET_TREE_PREVIEW_FAILED');
    }
  },

  async [RPC_METHOD.SPOTLIGHT_EXECUTE_ACTION](message) {
    try {
      await spotlightService.recordSelection(message.actionId, message.target, message.query ?? '');

      switch (message.actionId) {
        case 'open':
          return executeWithHandler(
            navigationHandlers[RPC_METHOD.NAVIGATE_TO],
            rpc.navigateTo({
              nodeId: requireNodeTarget(message.target),
              url: '' as never,
            }),
          );
        case 'open-node-in-tree':
          await openTreeAndFocusNode(
            requireTargetTreeId(message.target),
            requireNodeTarget(message.target),
          );
          return ok({ closeSpotlight: true });
        case 'open-tree':
          return executeWithHandler(
            treeHandlers[RPC_METHOD.OPEN_TREE],
            rpc.openTree({ treeId: requireTreeTarget(message.target) }),
          );
        case 'open-url-only':
        case 'open-url':
          await openUrlInNewTab(requireUrlTarget(message.target));
          return ok({ closeSpotlight: true });
        case 'search-default-engine':
          await searchWithDefaultEngine(requireSearchQueryTarget(message.target));
          return ok({ closeSpotlight: true });
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
    spotlightService.dispose(message.sessionId);
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

function requireTargetTreeId(target: SpotlightActionTarget | undefined): string {
  if (!target) {
    throw new Error('Tree target required');
  }
  if (target.kind === 'tree' || target.kind === 'node') {
    return target.treeId;
  }
  throw new Error('Tree target required');
}

function requireUrlTarget(target: SpotlightActionTarget | undefined): string {
  if (!target || target.kind !== 'url') {
    throw new Error('URL target required');
  }
  return target.url;
}

function requireSearchQueryTarget(target: SpotlightActionTarget | undefined): string {
  if (!target || target.kind !== 'search') {
    throw new Error('Search query target required');
  }
  return target.query;
}

async function openUrlInNewTab(url: string): Promise<void> {
  const targetWindow = await browser.windows.getLastFocused();
  await browser.tabs.create({
    windowId: targetWindow?.id,
    url,
    active: true,
  });
}

async function searchWithDefaultEngine(query: string): Promise<void> {
  const searchApi = (browser as typeof browser & {
    search?: {
      query?: (payload: {
        text: string;
        disposition?: 'CURRENT_TAB' | 'NEW_TAB' | 'NEW_WINDOW';
      }) => Promise<void> | void;
      search?: (payload: {
        query: string;
      }) => Promise<void> | void;
    };
  }).search;

  if (typeof searchApi?.query === 'function') {
    await searchApi.query({
      text: query,
      disposition: 'NEW_TAB',
    });
    return;
  }

  if (typeof searchApi?.search === 'function') {
    await searchApi.search({ query });
    return;
  }

  throw new Error('Default search engine API is unavailable');
}
