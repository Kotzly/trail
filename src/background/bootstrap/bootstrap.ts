import { bootstrapOpenTabs } from '../utils/node-utils';
import { treeStorage } from '../services/tree-storage';

/**
 * Initialize service worker on startup.
 */
export async function initBootstrap(): Promise<void> {
  // Ensure already-open tabs (including the first New Tab) are tracked at startup
  await bootstrapOpenTabs();
}
