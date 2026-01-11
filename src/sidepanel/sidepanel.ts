import './ui/graph/view/renderer.js';
import { NavigationTreeMapper } from '../shared/lib/mapper.js';
import type { NodeId } from '../shared/types/ids.js';
import { MSG, type RequestMessage, type TreeUpdatedInput } from '../shared/types/messages.js';
import { initPanelState, PanelState } from './state/panel-state.js';
import { PinnedManager } from '../background/state/pinned.js';
import type { NavigationTree } from '../background/state/nav-tree.js';
import { renderGraphView } from './ui/graph/view/renderer.js';
import type { TreeData } from './ui/graph/types.js';
import { GraphState } from './ui/graph/state/graph-state.js';
import { fetchCommandState, handleRedo, handleUndo } from './controllers/commands-controller.js';
import { initContextMenu } from './controllers/context-menu-controller.js';
import { PinnedDropdownController } from './controllers/pinned-controller.js';
import { applyTheme, saveSettingsQuick, toggleSettingsPopover } from './controllers/settings-controller.js';
import { clearSearch, nextSearchResult, performSearch, prevSearchResult } from './controllers/search-controller.js';
import { getSettings } from './api/settings.js';
import { clearTree, getTreeState } from './api/tree.js';
import type { ThemeId } from './ui/shared/themes.js';

const pinnedDropdown = new PinnedDropdownController({ triggerId: 'pinnedBtn' });

function updateEmptyState(hasRoot: boolean): void {
  const empty = document.getElementById('emptyState');
  if (!empty) return;
  empty.classList.toggle('hidden', hasRoot);
}

function updateTabCount(nodeTabCounts: Record<NodeId, number>): void {
  const total = Object.values(nodeTabCounts).reduce((sum, count) => sum + count, 0);
  const label = total === 1 ? '1 tab' : `${total} tabs`;
  const el = document.getElementById('stackCount');
  if (el) el.textContent = label;
}

function applyUIState(
  tree: NavigationTree,
  payload: TreeUpdatedInput,
  currentId: NodeId | null,
  nodeCount: number,
  shouldCenter: boolean,
): void {
  const container = document.getElementById('stackList');
  if (container) {
    const root = tree.getRoot();
    updateEmptyState(Boolean(root));
    const treeData: TreeData = {
      currentNodeId: currentId,
      nodeCount: nodeCount,
    };
    if (root) treeData.root = root;

    renderGraphView(
      treeData,
      container,
      {
        openNodeIds: new Set(payload.openNodeIds),
        tabStates: payload.tabStates,
        nodeTabCounts: payload.nodeTabCounts,
      },
    );

    if (shouldCenter && currentId !== null) {
      requestAnimationFrame(() => {
        const graphAPI = GraphState.getGraphAPI();
        if (graphAPI?.centerOnNode) {
          graphAPI.centerOnNode(currentId, true);
        }
      });
    }
  }

  updateTabCount(payload.nodeTabCounts);
  pinnedDropdown.refresh();

  if (PanelState.search.query) {
    performSearch(PanelState.search.query);
  }
}

async function applyTreeState(payload: TreeUpdatedInput): Promise<void> {
  const tree = NavigationTreeMapper.fromJSON(payload.tree);
  const pins = new PinnedManager(tree);

  PanelState.tree = tree;
  PanelState.pins = pins;
  PanelState.tabStates = payload.tabStates;

  const currentId = tree.getCurrentId();
  const nodeCount = tree.size();
  const prevNodeCount = PanelState.previousNodeCount;
  const prevNodeId = PanelState.previousNodeId;
  const hasPrev = prevNodeCount !== null;
  const shouldCenter =
    hasPrev &&
    ((prevNodeCount !== null && nodeCount > prevNodeCount) ||
      (currentId !== null && currentId !== prevNodeId));

  applyUIState(tree, payload, currentId, nodeCount, shouldCenter);

  PanelState.previousNodeId = currentId;
  PanelState.previousNodeCount = nodeCount;

  await fetchCommandState();
}

export async function initSidepanel(): Promise<void> {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const [settings, treeState] = await Promise.all([getSettings(), getTreeState()]);

      const tree = NavigationTreeMapper.fromJSON(treeState.tree);
      const pins = new PinnedManager(tree);

      await initPanelState(tree, pins);
      PanelState.settings = settings;
      applyTheme(settings.theme);

      initDomListeners();
      initContextMenu();
      initChromeListeners();

      await applyTreeState(treeState);
    } catch (error) {
      console.error('Failed to initialize sidepanel:', error);
    }
  }, { once: true });
}

function initDomListeners(): void {
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const clearBtn = document.getElementById('clearBtn');
  const pinnedBtn = document.getElementById('pinnedBtn');

  undoBtn?.addEventListener('click', () => handleUndo());
  redoBtn?.addEventListener('click', () => handleRedo());

  settingsBtn?.addEventListener('click', (e) => toggleSettingsPopover(e as MouseEvent));
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('settingsPopover');
    if (!popover || popover.classList.contains('hidden')) return;
    const target = e.target as Node | null;
    if (target && !popover.contains(target) && !(settingsBtn instanceof HTMLElement && settingsBtn.contains(target as Node))) {
      popover.classList.add('hidden');
    }
  });

  pinnedBtn?.addEventListener('click', () => pinnedDropdown.toggle());

  clearBtn?.addEventListener('click', async () => {
    try {
      await clearTree();
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  });

  const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
  const searchClear = document.getElementById('searchClear');
  const searchPrev = document.getElementById('searchPrev');
  const searchNext = document.getElementById('searchNext');

  searchInput?.addEventListener('input', () => performSearch(searchInput.value));
  searchClear?.addEventListener('click', () => clearSearch());
  searchPrev?.addEventListener('click', () => prevSearchResult());
  searchNext?.addEventListener('click', () => nextSearchResult());

  document.addEventListener('keydown', (e) => {
    if (!PanelState.metaKey) return;
    const isMeta = PanelState.isMac ? e.metaKey : e.ctrlKey;
    if (!isMeta) return;

    if (e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) handleRedo();
      else handleUndo();
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      searchInput?.focus();
      searchInput?.select();
    }
  });

  const themeButtons = document.querySelectorAll<HTMLButtonElement>('#themeIcons .popover-icon-btn');
  themeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const theme = btn.dataset.theme as ThemeId | undefined;
      if (!theme) return;
      applyTheme(theme);
      themeButtons.forEach(other => {
        other.classList.toggle('active', other === btn);
      });
      await saveSettingsQuick({ theme });
    });
  });

  const multiTabLimit = document.getElementById('multiTabLimit') as HTMLInputElement | null;
  if (multiTabLimit && PanelState.settings) {
    const current = PanelState.settings.maxOpenTabs;
    multiTabLimit.value = current === 0 ? '0' : String(current);
  }
  multiTabLimit?.addEventListener('change', async () => {
    const value = Number(multiTabLimit.value);
    const maxOpenTabs = Number.isFinite(value) && value >= 0 ? value : 0;
    await saveSettingsQuick({ maxOpenTabs });
  });
}

function initChromeListeners(): void {
  chrome.runtime.onMessage.addListener((message: RequestMessage) => {
    if (message.type !== MSG.TREE_UPDATED) return;
    applyTreeState(message).catch((error) => {
      console.error('Failed to apply tree update:', error);
    });
  });
}

void initSidepanel();
