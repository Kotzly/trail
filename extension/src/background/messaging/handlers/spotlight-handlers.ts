import {
  RPC_METHOD,
  defineRpcHandlers,
  ok,
  err,
} from '@shared/rpc/contracts.js';
import { settingsManager } from '../../services/settings.js';
import { spotlightSearchService } from '../../services/spotlight-search.js';

export const spotlightHandlers = defineRpcHandlers({
  /** @deprecated Use SPOTLIGHT_BOOTSTRAP instead. */
  async [RPC_METHOD.GET_SPOTLIGHT_DATA]() {
    const bootstrap = await spotlightSearchService.bootstrap(80);
    return ok({
      ...bootstrap,
      settings: settingsManager.get(),
    });
  },

  async [RPC_METHOD.SPOTLIGHT_BOOTSTRAP](message) {
    const bootstrap = await spotlightSearchService.bootstrap(message.limit ?? 80);
    return ok({
      ...bootstrap,
      settings: settingsManager.get(),
    });
  },

  async [RPC_METHOD.SPOTLIGHT_SEARCH](message) {
    try {
      const response = spotlightSearchService.search(
        message.sessionId,
        message.query,
        message.limit,
        message.requestSeq,
      );
      return ok(response);
    } catch (error) {
      if (error instanceof Error && error.message === 'SESSION_EXPIRED') {
        return err('SESSION_EXPIRED');
      }
      return err(error instanceof Error ? error.message : 'SPOTLIGHT_SEARCH_FAILED');
    }
  },

  async [RPC_METHOD.SPOTLIGHT_DISPOSE_SESSION](message) {
    spotlightSearchService.dispose(message.sessionId);
    return ok();
  },

  async [RPC_METHOD.TOGGLE_SPOTLIGHT]() {
    return ok();
  },
});
