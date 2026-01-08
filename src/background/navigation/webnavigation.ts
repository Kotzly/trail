import type { TabId } from '../../shared/types/ids.js';
import { handleNavigation } from './navigation-handler.js';
import { treeStorage } from '../services/tree-storage.js';
import { tabManager } from '../state/tab-manager.js';
import { shouldTrackUrl } from '../utils/url-utils.js';
import { notifyTreeUpdate } from '../messaging/notifications.js';

/**
 * Initialize webNavigation event listeners.
 */
export function initWebNavigation(): void {
  console.warn("initWebNavigation is no-op for now")
}
