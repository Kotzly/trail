import { create } from 'zustand';
import type { NodeId, Tag } from '../../../shared/types/ids.js';
import type { Settings } from '../../../shared/types/settings.js';
import type { TabState } from '../../../shared/types/tabs.js';
import type { CommandState, TreeUpdateReason, TreeUpdatedInput, TreesSnapshot } from '../../../shared/types/messages.js';
import { NavigationTreeMapper } from '../../../shared/lib/mapper.js';
import type { NavigationTree } from '../../../background/state/nav-tree.js';
import { PinnedManager } from '../../../background/state/pinned.js';
import type { TagDefinition } from '../../../shared/types/tags.js';
import type { NotificationItem } from '../notifications/types.js';
import type { TreeMeta, TreeSummary } from '../../../shared/types/tree.js';
import { getCollapsedAncestorIds } from '../graph/collapse-utils.js';
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

export type OverlayKind = 'modal' | 'dropdown' | 'context' | 'panel';

export type OverlayEffects = {
  lod: boolean;
  blur: boolean;
  kind: OverlayKind;
};

type OverlayEffectsState = {
  entries: Record<string, OverlayEffects>;
  lodCount: number;
  blurCount: number;
};

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
  trees: {
    active: TreeMeta | null;
    archived: TreeSummary[];
  };
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
    navStep: number;
    active: boolean;
    baseCurrentId: NodeId | null;
  };
  overlayEffects: OverlayEffectsState;
  deleteTreeConfirm: {
    open: boolean;
    rootId: NodeId | null;
  };
  ui: {
    settingsOpen: boolean;
    themePickerOpen: boolean;
    pinnedOpen: boolean;
    treesOpen: boolean;
    tagFilterOpen: boolean;
    tooltipsOpen: boolean;
  };
  graph: {
    tool: GraphTool;
    selectedNodeIds: Set<NodeId>;
    view: ViewState;
    resetVersion: number;
    viewIntent: TreeUpdatedInput['view'] | null;
    hoverNodeId: NodeId | null;
    collapsedNodeIds: Set<NodeId>;
    collapseVersion: number;
    collapseAction: { kind: 'collapse' | 'expand'; nodeIds: Set<NodeId> } | null;
  };
  contextMenu: ContextMenuState;
  metaKey: MetaKeyPair | null;
  isMac: boolean;
};

type StoreActions = {
  bootstrap: (settings: Settings, payload: TreeUpdatedInput, meta: MetaKeyPair, isMac: boolean) => void;
  applyTreeState: (payload: TreeUpdatedInput) => void;
  setTrees: (snapshot: TreesSnapshot) => void;
  setCommandState: (state: CommandState) => void;
  setTagDefs: (defs: TagDefinition[]) => void;
  upsertTagDef: (def: TagDefinition) => void;
  removeTagDef: (id: string) => void;
  toggleTagFilterTag: (tagId: Tag) => void;
  setTagFilterSelected: (selected: Set<Tag>) => void;
  clearTagFilter: () => void;
  setSearchQuery: (query: string, baseCurrentId?: NodeId | null) => void;
  setSearchResults: (results: NodeId[], index?: number) => void;
  setSearchIndex: (index: number) => void;
  clearSearch: () => void;
  setSettings: (settings: Settings) => void;
  setSettingsOpen: (open: boolean) => void;
  setThemePickerOpen: (open: boolean) => void;
  setPinnedOpen: (open: boolean) => void;
  setTreesOpen: (open: boolean) => void;
  setTagFilterOpen: (open: boolean) => void;
  setTooltipsOpen: (open: boolean) => void;
  closeAllPopups: () => void;
  openDeleteTreeConfirm: (rootId: NodeId) => void;
  closeDeleteTreeConfirm: () => void;
  registerOverlay: (id: string, effects: OverlayEffects) => void;
  unregisterOverlay: (id: string) => void;
  setAccount: (patch: Partial<AccountState>) => void;
  setAccountSnapshot: (snapshot: AccountSnapshot) => void;
  resetAccount: () => void;
  setGraphTool: (tool: GraphTool) => void;
  setSelectedNodeIds: (ids: Set<NodeId>) => void;
  clearSelection: () => void;
  setGraphView: (view: Partial<ViewState>) => void;
  setHoverNodeId: (nodeId: NodeId | null) => void;
  requestGraphReset: () => void;
  collapseNodes: (nodeIds: NodeId[]) => void;
  expandNodes: (nodeIds: NodeId[]) => void;
  openContextMenu: (menu: ContextMenuState) => void;
  closeContextMenu: () => void;
  clearViewIntent: () => void;
  addNotification: (notification: NotificationItem) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
};

type PopupKey = keyof StoreState['ui'];

const closeUiPopups = (ui: StoreState['ui']): StoreState['ui'] => ({
  ...ui,
  settingsOpen: false,
  themePickerOpen: false,
  pinnedOpen: false,
  treesOpen: false,
  tagFilterOpen: false,
  tooltipsOpen: ui.tooltipsOpen,
});

const openUiPopup = (ui: StoreState['ui'], key: PopupKey): StoreState['ui'] => ({
  ...closeUiPopups(ui),
  [key]: true,
});

const pruneCollapsedNodes = (tree: NavigationTree | null, collapsed: Set<NodeId>): Set<NodeId> => {
  if (!tree || collapsed.size === 0) return new Set<NodeId>();
  const next = new Set<NodeId>();
  collapsed.forEach((id) => {
    const node = tree.findNodeById(id);
    if (!node) return;
    if ((node.getChildren?.() ?? []).length === 0) return;
    next.add(id);
  });
  return next;
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
  trees: {
    active: null,
    archived: [],
  },
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
    navStep: 0,
    active: false,
    baseCurrentId: null,
  },
  overlayEffects: {
    entries: {},
    lodCount: 0,
    blurCount: 0,
  },
  deleteTreeConfirm: {
    open: false,
    rootId: null,
  },
  ui: {
    settingsOpen: false,
    themePickerOpen: false,
    pinnedOpen: false,
    treesOpen: false,
    tagFilterOpen: false,
    tooltipsOpen: false,
  },
  graph: {
    tool: 'select',
    selectedNodeIds: new Set<NodeId>(),
    view: { translateX: 0, translateY: 0, scale: 1 },
    resetVersion: 0,
    viewIntent: null,
    hoverNodeId: null,
    collapsedNodeIds: new Set<NodeId>(),
    collapseVersion: 0,
    collapseAction: null,
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
      const shouldResetTransient = payload.reason === 'tree-switch' || payload.reason === 'tree-reset';
      const resolvedViewIntent = shouldResetTransient ? nextViewIntent ?? null : nextViewIntent ?? state.graph.viewIntent;
      const nextCollapsedNodeIds = shouldResetTransient
        ? new Set<NodeId>()
        : pruneCollapsedNodes(tree, state.graph.collapsedNodeIds);
      const autoExpandIds = shouldResetTransient
        ? []
        : getCollapsedAncestorIds(tree, currentId, nextCollapsedNodeIds);
      const collapseVersion =
        autoExpandIds.length > 0 ? state.graph.collapseVersion + 1 : state.graph.collapseVersion;
      const collapseAction =
        autoExpandIds.length > 0
          ? ({ kind: 'expand', nodeIds: new Set<NodeId>(autoExpandIds) } as const)
          : state.graph.collapseAction;
      if (autoExpandIds.length > 0) {
        autoExpandIds.forEach((id) => nextCollapsedNodeIds.delete(id));
      }
      const nextGraph = {
        ...state.graph,
        viewIntent: resolvedViewIntent,
        collapsedNodeIds: nextCollapsedNodeIds,
        collapseVersion,
        collapseAction,
        ...(shouldResetTransient
          ? {
              selectedNodeIds: new Set<NodeId>(),
              hoverNodeId: null,
              collapseAction: null,
            }
          : {}),
      };
      return {
        tree,
        treeUpdate: { reason: payload.reason, at: Date.now() },
        pins,
        tabStates: payload.tabStates,
        nodeTabCounts: payload.nodeTabCounts,
        openNodeIds: new Set(payload.openNodeIds),
        currentNodeId: currentId,
        nodeCount,
        graph: nextGraph,
        ...(shouldResetTransient
          ? {
              search: {
                query: '',
                results: [],
                index: 0,
                navStep: 0,
                active: false,
                baseCurrentId: null,
              },
              contextMenu: null,
            }
          : {}),
      };
    });
  },

  setTrees: (snapshot) =>
    set({
      trees: {
        active: snapshot.active,
        archived: snapshot.archived,
      },
    }),
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
  setSearchQuery: (query, baseCurrentId) =>
    set((state) => {
      const active = query.length > 0;
      if (!active) {
        return {
          search: {
            query: '',
            results: [],
            index: 0,
            navStep: 0,
            active: false,
            baseCurrentId: null,
          },
        };
      }
      const base =
        baseCurrentId ?? state.search.baseCurrentId ?? state.currentNodeId ?? null;
      return {
        search: {
          ...state.search,
          query,
          active,
          baseCurrentId: base,
        },
      };
    }),
  setSearchResults: (results, index = 0) =>
    set((state) => {
      const nextIndex = results.length === 0 ? 0 : Math.min(index, results.length - 1);
      return {
        search: {
          ...state.search,
          results,
          index: nextIndex,
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
        navStep: state.search.navStep + 1,
      },
    })),
  clearSearch: () =>
    set({
      search: {
        query: '',
        results: [],
        index: 0,
        navStep: 0,
        active: false,
        baseCurrentId: null,
      },
    }),

  setSettings: (settings) => set({ settings }),
  setSettingsOpen: (open) =>
    set((state) =>
      open
        ? { ui: openUiPopup(state.ui, 'settingsOpen'), contextMenu: null }
        : { ui: { ...state.ui, settingsOpen: false } },
    ),
  setThemePickerOpen: (open) =>
    set((state) =>
      open
        ? { ui: openUiPopup(state.ui, 'themePickerOpen'), contextMenu: null }
        : { ui: { ...state.ui, themePickerOpen: false } },
    ),
  setPinnedOpen: (open) =>
    set((state) =>
      open
        ? { ui: openUiPopup(state.ui, 'pinnedOpen'), contextMenu: null }
        : { ui: { ...state.ui, pinnedOpen: false } },
    ),
  setTreesOpen: (open) =>
    set((state) =>
      open
        ? { ui: openUiPopup(state.ui, 'treesOpen'), contextMenu: null }
        : { ui: { ...state.ui, treesOpen: false } },
    ),
  setTagFilterOpen: (open) =>
    set((state) =>
      open
        ? { ui: openUiPopup(state.ui, 'tagFilterOpen'), contextMenu: null }
        : { ui: { ...state.ui, tagFilterOpen: false } },
    ),
  setTooltipsOpen: (open) =>
    set((state) => ({ ui: { ...state.ui, tooltipsOpen: open } })),
  closeAllPopups: () => set((state) => ({ ui: closeUiPopups(state.ui), contextMenu: null })),
  openDeleteTreeConfirm: (rootId) =>
    set((state) => ({
      deleteTreeConfirm: { open: true, rootId },
      contextMenu: null,
      ui: closeUiPopups(state.ui),
    })),
  closeDeleteTreeConfirm: () =>
    set({
      deleteTreeConfirm: { open: false, rootId: null },
    }),
  registerOverlay: (id, effects) =>
    set((state) => {
      const prev = state.overlayEffects.entries[id];
      if (prev && prev.lod === effects.lod && prev.blur === effects.blur && prev.kind === effects.kind) {
        return state;
      }
      const entries = { ...state.overlayEffects.entries, [id]: effects };
      let lodCount = 0;
      let blurCount = 0;
      Object.values(entries).forEach((entry) => {
        if (entry.lod) lodCount += 1;
        if (entry.blur) blurCount += 1;
      });
      return {
        overlayEffects: {
          entries,
          lodCount,
          blurCount,
        },
      };
    }),
  unregisterOverlay: (id) =>
    set((state) => {
      if (!state.overlayEffects.entries[id]) return state;
      const { [id]: _removed, ...entries } = state.overlayEffects.entries;
      let lodCount = 0;
      let blurCount = 0;
      Object.values(entries).forEach((entry) => {
        if (entry.lod) lodCount += 1;
        if (entry.blur) blurCount += 1;
      });
      return {
        overlayEffects: {
          entries,
          lodCount,
          blurCount,
        },
      };
    }),
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
  requestGraphReset: () =>
    set((state) => ({
      graph: { ...state.graph, resetVersion: state.graph.resetVersion + 1 },
    })),
  collapseNodes: (nodeIds) =>
    set((state) => {
      if (nodeIds.length === 0) return state;
      const next = new Set(state.graph.collapsedNodeIds);
      const changed: NodeId[] = [];
      nodeIds.forEach((id) => {
        if (next.has(id)) return;
        next.add(id);
        changed.push(id);
      });
      if (changed.length === 0) return state;
      return {
        graph: {
          ...state.graph,
          collapsedNodeIds: next,
          collapseVersion: state.graph.collapseVersion + 1,
          collapseAction: { kind: 'collapse', nodeIds: new Set(changed) },
        },
      };
    }),
  expandNodes: (nodeIds) =>
    set((state) => {
      if (nodeIds.length === 0) return state;
      const next = new Set(state.graph.collapsedNodeIds);
      const changed: NodeId[] = [];
      nodeIds.forEach((id) => {
        if (!next.has(id)) return;
        next.delete(id);
        changed.push(id);
      });
      if (changed.length === 0) return state;
      return {
        graph: {
          ...state.graph,
          collapsedNodeIds: next,
          collapseVersion: state.graph.collapseVersion + 1,
          collapseAction: { kind: 'expand', nodeIds: new Set(changed) },
        },
      };
    }),

  openContextMenu: (menu) =>
    set((state) => ({
      contextMenu: menu,
      ui: closeUiPopups(state.ui),
    })),
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
