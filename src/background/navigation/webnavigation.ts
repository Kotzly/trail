import type { TabId } from '../../shared/types/ids';
import { handleNavigation } from './navigation-handler';
import { treeStorage } from '../services/tree-storage';
import { tabManager } from '../state/tab-manager';
import { shouldTrackUrl } from '../utils/url-utils';
import { notifyTreeUpdate } from '../messaging/notifications';

/**
 * Initialize webNavigation event listeners.
 */
export function initWebNavigation(): void {
  console.warn("initWebNavigation is no-op for now")
}
