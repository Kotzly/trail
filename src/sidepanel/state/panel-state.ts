import { NodeId, TabId } from "../../shared/types/ids";
import { Settings } from "../../shared/types/settings";
import type { TreeNode } from "../../background/state/treenode";
import { TabState } from "../../shared/types/tabs";
import { isMac } from "../../shared/utils/platform"
import { NavigationTree } from "../../background/state/tree-store";
import { PinnedManager } from "../../background/state/pinned";

export async function initPanelState(): Promise<void> {
    PanelState.metaKey = (await isMac()) ? {view: '⌘', write: 'cmd'} : {view: '^', write: 'ctrl'};
    // todo: initialize navigation tree here
    // and pins manager here
}

export const PanelState = {
    settings: null as Settings | null,

    currentTabId: null as TabId | null,

    currentNodeId: null as NodeId | null,
    previousNodeId: null as NodeId | null,

    openNodeIds: new Set<NodeId>(),
    tabStates: {} as Record<NodeId, TabState>,

    tree: null as NavigationTree | null,
    pins: null as PinnedManager | null,

    search: {
        query: '',
        results: [] as NodeId[],
        index: 0,
    },
    
    contextMenu: {
        node: null as TreeNode | null,
        tabs: [] as chrome.tabs.Tab[],
    },

    metaKey: null as metaKeyPair | null,
}

type metaKeyPair = {view: '^', write: 'ctrl'} | {view: '⌘', write: 'cmd'} | null;