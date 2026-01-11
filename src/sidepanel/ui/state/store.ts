import { create } from 'zustand';
import type { NodeId } from '../../../shared/types/ids.js';
import type { Settings } from '../../../shared/types/settings.js';
import type { TabState } from '../../../shared/types/tabs.js';
import type { CommandState, TreeUpdatedInput } from '../../../shared/types/messages.js';
import { NavigationTreeMapper } from '../../../shared/lib/mapper.js';
import type { NavigationTree } from '../../../background/state/nav-tree.js';
import { PinnedManager } from '../../../background/state/pinned.js';

export type MetaKeyPair = { short: '^'; long: 'ctrl' } | { short: '⌘'; long: 'cmd' };

type GraphTool = 'hand' | 'select';

export type ViewState = {
  translateX: number;
  translateY: number;
  scale: number;
};

type ContextMenuState =
  | {
      type: 'node';
      nodeId: NodeId;
      position: { x: number; y: number };
    }
  | {
      type: 'bulk';
      nodeIds: NodeId[];
      position: { x: number; y: number };
    }
  | null;

type StoreState = {
  settings: Settings | null;
  tree: NavigationTree | null;
  pins: PinnedManager | null;
  tabStates: Record<NodeId, TabState>;
  nodeTabCounts: Record<NodeId, number>;
  openNodeIds: Set<NodeId>;
  currentNodeId: NodeId | null;
  nodeCount: number;
  commandState: CommandState | null;
  search: {
    query: string;
    results: NodeId[];
    index: number;
  };
  ui: {
    settingsOpen: boolean;
    pinnedOpen: boolean;
  };
  graph: {
    tool: GraphTool;
    selectedNodeIds: Set<NodeId>;
    view: ViewState;
  };
  contextMenu: ContextMenuState;
  metaKey: MetaKeyPair | null;
  isMac: boolean;
};

type StoreActions = {
  bootstrap: (settings: Settings, payload: TreeUpdatedInput, meta: MetaKeyPair, isMac: boolean) => void;
  applyTreeState: (payload: TreeUpdatedInput) => void;
  setCommandState: (state: CommandState) => void;
  setSearch: (query: string, results: NodeId[], index?: number) => void;
  setSearchIndex: (index: number) => void;
  clearSearch: () => void;
  setSettings: (settings: Settings) => void;
  setSettingsOpen: (open: boolean) => void;
  setPinnedOpen: (open: boolean) => void;
  setGraphTool: (tool: GraphTool) => void;
  setSelectedNodeIds: (ids: Set<NodeId>) => void;
  toggleSelectedNode: (id: NodeId) => void;
  clearSelection: () => void;
  setGraphView: (view: Partial<ViewState>) => void;
  openContextMenu: (menu: ContextMenuState) => void;
  closeContextMenu: () => void;
};

export const useStore = create<StoreState & StoreActions>((set, get) => ({
  settings: null,
  tree: null,
  pins: null,
  tabStates: {},
  nodeTabCounts: {},
  openNodeIds: new Set<NodeId>(),
  currentNodeId: null,
  nodeCount: 0,
  commandState: null,
  search: {
    query: '',
    results: [],
    index: 0,
  },
  ui: {
    settingsOpen: false,
    pinnedOpen: false,
  },
  graph: {
    tool: 'hand',
    selectedNodeIds: new Set<NodeId>(),
    view: { translateX: 0, translateY: 0, scale: 1 },
  },
  contextMenu: null,
  metaKey: null,
  isMac: false,

  bootstrap: (settings, payload, meta, isMac) => {
    const tree = NavigationTreeMapper.fromJSON(payload.tree);
    const pins = new PinnedManager(tree);
    const currentId = tree.getCurrentId();
    const nodeCount = tree.size();
    set({
      settings,
      tree,
      pins,
      tabStates: payload.tabStates,
      nodeTabCounts: payload.nodeTabCounts,
      openNodeIds: new Set(payload.openNodeIds),
      currentNodeId: currentId,
      nodeCount,
      metaKey: meta,
      isMac,
    });
  },

  applyTreeState: (payload) => {
    const tree = NavigationTreeMapper.fromJSON(payload.tree);
    const pins = new PinnedManager(tree);
    const currentId = tree.getCurrentId();
    const nodeCount = tree.size();
    set((state) => ({
      tree,
      pins,
      tabStates: payload.tabStates,
      nodeTabCounts: payload.nodeTabCounts,
      openNodeIds: new Set(payload.openNodeIds),
      currentNodeId: currentId,
      nodeCount,
    }));
  },

  setCommandState: (state) => set({ commandState: state }),
  setSearch: (query, results, index = 0) =>
    set({
      search: {
        query,
        results,
        index: results.length === 0 ? 0 : Math.min(index, results.length - 1),
      },
    }),
  setSearchIndex: (index) =>
    set((state) => ({
      search: {
        ...state.search,
        index:
          state.search.results.length === 0
            ? 0
            : ((index % state.search.results.length) + state.search.results.length) %
              state.search.results.length,
      },
    })),
  clearSearch: () =>
    set({
      search: {
        query: '',
        results: [],
        index: 0,
      },
    }),

  setSettings: (settings) => set({ settings }),
  setSettingsOpen: (open) => set((state) => ({ ui: { ...state.ui, settingsOpen: open } })),
  setPinnedOpen: (open) => set((state) => ({ ui: { ...state.ui, pinnedOpen: open } })),

  setGraphTool: (tool) => set((state) => ({ graph: { ...state.graph, tool } })),
  setSelectedNodeIds: (ids) =>
    set((state) => ({ graph: { ...state.graph, selectedNodeIds: new Set(ids) } })),
  toggleSelectedNode: (id) =>
    set((state) => {
      const next = new Set(state.graph.selectedNodeIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { graph: { ...state.graph, selectedNodeIds: next } };
    }),
  clearSelection: () =>
    set((state) => ({ graph: { ...state.graph, selectedNodeIds: new Set<NodeId>() } })),
  setGraphView: (view) =>
    set((state) => ({
      graph: { ...state.graph, view: { ...state.graph.view, ...view } },
    })),

  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),
}));
