import './ui/graph/view/renderer';
import { initPanelState } from './state/panel-state';
import { PinnedManager } from '../background/state/pinned';
import { NavigationTree } from '../background/state/tree-store';
import { fetchCommandState } from './controllers/commands-controller';
import { initContextMenu } from './controllers/context-menu-controller';


export async function initSidepanel(tree: NavigationTree, pins: PinnedManager): Promise<void> {
  document.addEventListener('DOMContentLoaded', async () => {
    initPanelState(tree, pins);
    initDomListeners();
    initContextMenu();
    initChromeListeners();

    // await loadCurrentTab(); // todo: get wtf this is
    await fetchCommandState();
  }, { once: true });
}

function initDomListeners(): void {
  // todo: implement
}

function initChromeListeners(): void {
  // todo: implement
}