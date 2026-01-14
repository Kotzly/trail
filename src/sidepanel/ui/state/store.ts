import { create } from 'zustand';
import type { NodeId, Tag } from '../../../shared/types/ids.js';
import type { Settings } from '../../../shared/types/settings.js';
import type { TabState } from '../../../shared/types/tabs.js';
import type { CommandState, TreeUpdateReason, TreeUpdatedInput } from '../../../shared/types/messages.js';
import { NavigationTreeMapper } from '../../../shared/lib/mapper.js';
import type { NavigationTree } from '../../../background/state/nav-tree.js';
import { PinnedManager } from '../../../background/state/pinned.js';
import type { TagDefinition } from '../../../shared/types/tags.js';
import type { NotificationItem } from '../notifications/types.js';
import type {
  AccountError,
  AccountSnapshot,
  AuthSession,
  BillingStatus,
  Plan,
  Subscription,
  User,
} from '../../../shared/types/account.js';

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

type AccountStatus = 'idle' | 'loading' | 'ready' | 'error';
type NetworkStatus = 'online' | 'offline' | 'degraded';

type AccountState = {
  status: AccountStatus;
  network: NetworkStatus;
  session: AuthSession;
  user: User | null;
  subscription: Subscription | null;
  billing: BillingStatus | null;
  plans: Plan[];
  error: AccountError | null;
  lastSyncedAt: string | null;
};

type StoreState = {
  settings: Settings | null;
  account: AccountState;
  tree: NavigationTree | null;
  treeUpdate: {
    reason: TreeUpdateReason;
    at: number;
  } | null;
  pins: PinnedManager | null;
  tabStates: Record<NodeId, TabState>;
  nodeTabCounts: Record<NodeId, number>;
  openNodeIds: Set<NodeId>;
  currentNodeId: NodeId | null;
  nodeCount: number;
  commandState: CommandState | null;
  tagDefs: Record<string, TagDefinition>;
  tagDefsList: TagDefinition[];
  tagFilter: {
    selected: Set<Tag>;
  };
  notifications: NotificationItem[];
  search: {
    query: string;
    results: NodeId[];
    index: number;
    active: boolean;
    baseCurrentId: NodeId | null;
  };
  ui: {
    settingsOpen: boolean;
    pinnedOpen: boolean;
    tagFilterOpen: boolean;
  };
  graph: {
    tool: GraphTool;
    selectedNodeIds: Set<NodeId>;
    view: ViewState;
    layoutVersion: number;
    resetVersion: number;
    viewIntent: TreeUpdatedInput['view'] | null;
    hoverNodeId: NodeId | null;
  };
  contextMenu: ContextMenuState;
  metaKey: MetaKeyPair | null;
  isMac: boolean;
};

type StoreActions = {
  bootstrap: (settings: Settings, payload: TreeUpdatedInput, meta: MetaKeyPair, isMac: boolean) => void;
  applyTreeState: (payload: TreeUpdatedInput) => void;
  setCommandState: (state: CommandState) => void;
  setTagDefs: (defs: TagDefinition[]) => void;
  upsertTagDef: (def: TagDefinition) => void;
  removeTagDef: (id: string) => void;
  toggleTagFilterTag: (tagId: Tag) => void;
  setTagFilterSelected: (selected: Set<Tag>) => void;
  clearTagFilter: () => void;
  setSearch: (
    query: string,
    results: NodeId[],
    index?: number,
    baseCurrentId?: NodeId | null
  ) => void;
  setSearchIndex: (index: number) => void;
  clearSearch: () => void;
  setSettings: (settings: Settings) => void;
  setSettingsOpen: (open: boolean) => void;
  setPinnedOpen: (open: boolean) => void;
  setTagFilterOpen: (open: boolean) => void;
  setAccount: (patch: Partial<AccountState>) => void;
  setAccountSnapshot: (snapshot: AccountSnapshot) => void;
  resetAccount: () => void;
  setGraphTool: (tool: GraphTool) => void;
  setSelectedNodeIds: (ids: Set<NodeId>) => void;
  toggleSelectedNode: (id: NodeId) => void;
  clearSelection: () => void;
  setGraphView: (view: Partial<ViewState>) => void;
  setHoverNodeId: (nodeId: NodeId | null) => void;
  setNodeLayoutOffset: (nodeId: NodeId, offsetX: number, offsetY: number) => void;
  setNodeLayoutRadial: (nodeId: NodeId, angleDelta: number, radiusDelta: number) => void;
  requestGraphReset: () => void;
  openContextMenu: (menu: ContextMenuState) => void;
  closeContextMenu: () => void;
  clearViewIntent: () => void;
  addNotification: (notification: NotificationItem) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
};

export const useStore = create<StoreState & StoreActions>((set, get) => ({
  settings: null,
  account: {
    status: 'idle',
    network: 'online',
    session: { status: 'guest' },
    user: null,
    subscription: null,
    billing: { state: 'none' },
    plans: [],
    error: null,
    lastSyncedAt: null,
  },
  tree: null,
  treeUpdate: null,
  pins: null,
  tabStates: {},
  nodeTabCounts: {},
  openNodeIds: new Set<NodeId>(),
  currentNodeId: null,
  nodeCount: 0,
  commandState: null,
  tagDefs: {},
  tagDefsList: [],
  tagFilter: {
    selected: new Set<Tag>(),
  },
  notifications: [],
  search: {
    query: '',
    results: [],
    index: 0,
    active: false,
    baseCurrentId: null,
  },
  ui: {
    settingsOpen: false,
    pinnedOpen: false,
    tagFilterOpen: false,
  },
  graph: {
    tool: 'select',
    selectedNodeIds: new Set<NodeId>(),
    view: { translateX: 0, translateY: 0, scale: 1 },
    layoutVersion: 0,
    resetVersion: 0,
    viewIntent: null,
    hoverNodeId: null,
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
      treeUpdate: { reason: payload.reason, at: Date.now() },
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
    set((state) => {
      const nextViewIntent = payload.view ?? state.graph.viewIntent;
      return {
        tree,
        treeUpdate: { reason: payload.reason, at: Date.now() },
        pins,
        tabStates: payload.tabStates,
        nodeTabCounts: payload.nodeTabCounts,
        openNodeIds: new Set(payload.openNodeIds),
        currentNodeId: currentId,
        nodeCount,
        graph: nextViewIntent ? { ...state.graph, viewIntent: nextViewIntent } : state.graph,
      };
    });
  },

  setCommandState: (state) => set({ commandState: state }),
  setTagDefs: (defs) =>
    set((state) => {
      const tagDefs = Object.fromEntries(defs.map((def) => [def.id, def]));
      const nextSelected = new Set<Tag>();
      state.tagFilter.selected.forEach((id) => {
        if (tagDefs[id]) nextSelected.add(id);
      });
      const selectedChanged = nextSelected.size !== state.tagFilter.selected.size;
      return {
        tagDefs,
        tagDefsList: defs,
        tagFilter: selectedChanged ? { ...state.tagFilter, selected: nextSelected } : state.tagFilter,
      };
    }),
  upsertTagDef: (def) =>
    set((state) => {
      const nextMap = { ...state.tagDefs, [def.id]: def };
      const nextList = state.tagDefsList.some((item) => item.id === def.id)
        ? state.tagDefsList.map((item) => (item.id === def.id ? def : item))
        : [...state.tagDefsList, def];
      return { tagDefs: nextMap, tagDefsList: nextList };
    }),
  removeTagDef: (id) =>
    set((state) => {
      if (!state.tagDefs[id]) return state;
      const nextMap = { ...state.tagDefs };
      delete nextMap[id];
      return {
        tagDefs: nextMap,
        tagDefsList: state.tagDefsList.filter((item) => item.id !== id),
      };
    }),
  toggleTagFilterTag: (tagId) =>
    set((state) => {
      const next = new Set(state.tagFilter.selected);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return { tagFilter: { ...state.tagFilter, selected: next } };
    }),
  setTagFilterSelected: (selected) =>
    set((state) => ({ tagFilter: { ...state.tagFilter, selected: new Set(selected) } })),
  clearTagFilter: () =>
    set((state) => ({ tagFilter: { ...state.tagFilter, selected: new Set<Tag>() } })),
  setSearch: (query, results, index = 0, baseCurrentId) =>
    set((state) => {
      const active = query.length > 0;
      const nextIndex = results.length === 0 ? 0 : Math.min(index, results.length - 1);
      const base =
        active
          ? baseCurrentId ?? state.search.baseCurrentId ?? state.currentNodeId ?? null
          : null;
      return {
        search: {
          ...state.search,
          query,
          results,
          index: nextIndex,
          active,
          baseCurrentId: base,
        },
      };
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
        active: false,
        baseCurrentId: null,
      },
    }),

  setSettings: (settings) => set({ settings }),
  setSettingsOpen: (open) => set((state) => ({ ui: { ...state.ui, settingsOpen: open } })),
  setPinnedOpen: (open) => set((state) => ({ ui: { ...state.ui, pinnedOpen: open } })),
  setTagFilterOpen: (open) => set((state) => ({ ui: { ...state.ui, tagFilterOpen: open } })),
  setAccount: (patch) => set((state) => ({ account: { ...state.account, ...patch } })),
  setAccountSnapshot: (snapshot) =>
    set((state) => ({
      account: {
        ...state.account,
        ...snapshot,
        status: 'ready',
        network: 'online',
        error: null,
        lastSyncedAt: new Date().toISOString(),
      },
    })),
  resetAccount: () =>
    set({
      account: {
        status: 'idle',
        network: 'online',
        session: { status: 'guest' },
        user: null,
        subscription: null,
        billing: { state: 'none' },
        plans: [],
        error: null,
        lastSyncedAt: null,
      },
    }),

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
  setHoverNodeId: (nodeId) =>
    set((state) => ({
      graph: { ...state.graph, hoverNodeId: nodeId },
    })),
  setNodeLayoutOffset: (nodeId, offsetX, offsetY) =>
    set((state) => {
      const tree = state.tree;
      if (!tree) return state;
      const node = tree.findNodeById(nodeId);
      if (!node) return state;
      const radial = node.data.layout?.radial;
      node.data.layout = radial ? { offsetX, offsetY, radial } : { offsetX, offsetY };
      return {
        tree,
        graph: { ...state.graph, layoutVersion: state.graph.layoutVersion + 1 },
      };
    }),
  setNodeLayoutRadial: (nodeId, angleDelta, radiusDelta) =>
    set((state) => {
      const tree = state.tree;
      if (!tree) return state;
      const node = tree.findNodeById(nodeId);
      if (!node) return state;
      const offsetX = node.data.layout?.offsetX ?? 0;
      const offsetY = node.data.layout?.offsetY ?? 0;
      node.data.layout = { offsetX, offsetY, radial: { angleDelta, radiusDelta } };
      return {
        tree,
        graph: { ...state.graph, layoutVersion: state.graph.layoutVersion + 1 },
      };
    }),
  requestGraphReset: () =>
    set((state) => ({
      graph: { ...state.graph, resetVersion: state.graph.resetVersion + 1 },
    })),

  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),
  clearViewIntent: () =>
    set((state) => ({
      graph: { ...state.graph, viewIntent: null },
    })),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    })),
  clearNotifications: () => set({ notifications: [] }),
}));
