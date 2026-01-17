import { NodeId, TabId } from "../../shared/types/ids.js";
import { Settings } from "../../shared/types/settings.js";
import { TabState } from "../../shared/types/tabs.js";
import { isMac } from "../../shared/utils/platform.js"
import { NavigationTree } from "../../background/state/nav-tree.js";
import { PinnedManager } from "../../background/state/pinned.js";
import { tabManager } from "../../background/state/tab-manager.js";
import { NavigationNode } from "../../shared/types/node.js";

export async function initPanelState(tree: NavigationTree, pins: PinnedManager): Promise<void> {
    PanelState.tree = tree;
    PanelState.pins = pins;
    PanelState.isMac = await isMac();
    PanelState.metaKey = PanelState.isMac ? {short: '⌘', long: 'cmd'} : {short: '^', long: 'ctrl'};

}

export const PanelState = {
    settings: null as Settings | null,

    previousNodeId: null as NodeId | null,
    previousNodeCount: null as number | null,
    tabStates: {} as Record<NodeId, TabState>,

    tree: null as NavigationTree | null,
    pins: null as PinnedManager | null,
    tabs: tabManager,

    search: {
        query: '',
        results: [] as NodeId[],
        index: 0,
    },
    
    contextMenu: {
        node: null as NavigationNode | null,
        tabs: [] as chrome.tabs.Tab[],
    },

    metaKey: null as metaKeyPair | null,
    isMac: false,
}

type metaKeyPair = {short: '^', long: 'ctrl'} | {short: '⌘', long: 'cmd'} | null;
