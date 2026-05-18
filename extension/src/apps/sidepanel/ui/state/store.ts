import { create } from "zustand";
import type { NodeId, Tag } from "@shared/types/ids.js";
import type { OnboardingPersona, OnboardingPhase } from "@shared/config/storage-items.js";
import type { Settings } from "@shared/types/settings.js";
import type { TabState } from "@shared/types/tabs.js";
import type {
  CommandState,
  TreeUpdateReason,
  TreeUpdatedInput,
  TreesSnapshot,
} from "@shared/rpc/contracts.js";

export type SyncStatus = "idle" | "saving" | "saved" | "error";
import { NavigationTreeMapper } from "@shared/lib/mapper.js";
import type { NavigationTree } from "@background/state/nav-tree.js";
import { PinnedManager } from "@background/state/pinned.js";
import type { TreeMeta, TreeSummary, NavigationTreeJSON } from "@shared/types/tree.js";
import type { ResolvedFlags } from "@shared/types/flags.js";
import type {
  ApplyError,
  ConflictPickState,
  ConflictPreview,
  LabelPick,
  NodePick,
  StructuralPick,
} from "@shared/types/tree-diff.js";

type GraphTool = "hand" | "select";

export type ViewState = {
  translateX: number;
  translateY: number;
  scale: number;
};

type ContextMenuState =
  | {
      type: "node";
      nodeId: NodeId;
      position: { x: number; y: number };
    }
  | {
      type: "bulk";
      nodeIds: NodeId[];
      position: { x: number; y: number };
    }
  | null;

export type OverlayKind = "modal" | "dropdown" | "context" | "panel";

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

type StoreState = {
  settings: Settings | null;
  flags: ResolvedFlags | null;
  tree: NavigationTree | null;
  treeJSON: NavigationTreeJSON | null;
  precomputedPositions: Record<string, { x: number; y: number }> | null;
  treeUpdate: {
    reason: TreeUpdateReason;
    at: number;
  } | null;
  trees: {
    active: TreeMeta | null;
    others: TreeSummary[];
  };
  pins: PinnedManager | null;
  tabStates: Record<NodeId, TabState>;
  nodeTabCounts: Record<NodeId, number>;
  nodeRecency: Record<NodeId, number>;
  openNodeIds: Set<NodeId>;
  currentNodeId: NodeId | null;
  nodeCount: number;
  commandState: CommandState | null;
  tagFilter: {
    selected: Set<Tag>;
  };
  search: {
    query: string;
    results: NodeId[];
    index: number;
    navStep: number;
    active: boolean;
    baseCurrentId: NodeId | null;
  };
  overlayEffects: OverlayEffectsState;
  ui: {
    settingsOpen: boolean;
    themePickerOpen: boolean;
    pinnedOpen: boolean;
    treesOpen: boolean;
    tagFilterOpen: boolean;
  };
  graph: {
    tool: GraphTool;
    selectedNodeIds: Set<NodeId>;
    view: ViewState;
    resetVersion: number;
    viewIntent: TreeUpdatedInput["view"] | null;
    hoverNodeId: NodeId | null;
    collapsedNodeIds: Set<NodeId>;
    collapsedByTree: Map<NodeId, Set<NodeId>>;
    collapseVersion: number;
    collapseAction: { kind: "collapse" | "expand"; nodeIds: Set<NodeId> } | null;
    /**
     * Tip node IDs the user has manually unfolded for chain-fold
     * (collapselist patterns). The fold transform skips these chains,
     * rendering them as normal parent→child nodes. Saved per tree,
     * resets on tree switch (same lifecycle as `collapsedNodeIds`).
     */
    unfoldedChainIds: Set<NodeId>;
    unfoldedChainsByTree: Map<NodeId, Set<NodeId>>;
    /**
     * Nodes the user has expanded **by clicking the `+N` badge** (as
     * opposed to context-menu Expand or double-click). The TrailNode
     * uses this to render a re-collapse arrow next to the node — a
     * shortcut to undo the badge action. Cleared on any other
     * collapse/expand path.
     */
    badgeExpandedIds: Set<NodeId>;
    badgeExpandedByTree: Map<NodeId, Set<NodeId>>;
  };
  syncStatus: SyncStatus;
  commandPalette: { open: boolean };
  renameTarget: NodeId | null;
  authState: AuthUiState;
  syncConflict: SyncConflictUiState | null;
  contextMenu: ContextMenuState;
  pickTarget: { type: "duplicate"; sourceNodeId: NodeId } | null;
  /**
   * Interactive onboarding v2 state. Mirrors the persisted
   * `onboardingStateItem` (storage-items.ts) so UI can read synchronously
   * without awaiting storage. Writes go through the onboarding API,
   * which updates both storage and this slice.
   */
  onboarding: {
    phase: OnboardingPhase | null;
    wizardStep: number;
    persona: OnboardingPersona | null;
    startedAt: number | null;
    completedAt: number | null;
  };
};

type StoreActions = {
  bootstrapGraph: (settings: Settings, payload: TreeUpdatedInput) => void;
  applyTreeState: (payload: TreeUpdatedInput) => void;
  setTrees: (snapshot: TreesSnapshot) => void;
  setCommandState: (state: CommandState) => void;
  toggleTagFilterTag: (tagId: Tag) => void;
  setTagFilterSelected: (selected: Set<Tag>) => void;
  clearTagFilter: () => void;
  setSearchQuery: (query: string, baseCurrentId?: NodeId | null) => void;
  setSearchResults: (results: NodeId[], index?: number) => void;
  setSearchIndex: (index: number) => void;
  clearSearch: () => void;
  setSettings: (settings: Settings) => void;
  setFlags: (flags: ResolvedFlags) => void;
  setSettingsOpen: (open: boolean) => void;
  setThemePickerOpen: (open: boolean) => void;
  setPinnedOpen: (open: boolean) => void;
  setTreesOpen: (open: boolean) => void;
  setTagFilterOpen: (open: boolean) => void;
  closeAllPopups: () => void;
  registerOverlay: (id: string, effects: OverlayEffects) => void;
  unregisterOverlay: (id: string) => void;
  setGraphTool: (tool: GraphTool) => void;
  setSelectedNodeIds: (ids: Set<NodeId>) => void;
  clearSelection: () => void;
  setGraphView: (view: Partial<ViewState>) => void;
  setHoverNodeId: (nodeId: NodeId | null) => void;
  requestGraphReset: () => void;
  collapseNodes: (nodeIds: NodeId[]) => void;
  expandNodes: (nodeIds: NodeId[]) => void;
  toggleChainUnfolded: (nodeId: NodeId) => void;
  toggleBadgeCollapse: (nodeId: NodeId) => void;
  openContextMenu: (menu: ContextMenuState) => void;
  closeContextMenu: () => void;
  clearViewIntent: () => void;
  setPickTarget: (target: StoreState["pickTarget"]) => void;
  clearPickTarget: () => void;
  setSyncStatus: (status: SyncStatus) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  startInlineRename: (nodeId: NodeId) => void;
  cancelInlineRename: () => void;
  setAuthState: (state: AuthUiState) => void;
  /**
   * Accept a conflict event (from the runtime-messaging ingest) OR a
   * fully-shaped slice (for test/restore). Null clears.
   */
  setSyncConflict: (conflict: SyncConflictEventIngest | SyncConflictUiState | null) => void;
  setConflictDialogOpen: (open: boolean, expectedActiveTreeId?: string | null) => void;
  setConflictPreview: (preview: ConflictPreview) => void;
  setConflictStale: (stale: boolean) => void;
  setConflictNodePick: (nodeId: NodeId, pick: NodePick) => void;
  setConflictStructuralPick: (nodeId: NodeId, pick: StructuralPick) => void;
  setConflictLabelPick: (pick: LabelPick | null) => void;
  setConflictReorderPick: (parentId: NodeId, order: "mine-order" | "theirs-order") => void;
  resetConflictPicks: () => void;
  setConflictApplyError: (error: ApplyError | null) => void;
  clearConflict: () => void;
  setOnboarding: (patch: Partial<StoreState["onboarding"]>) => void;
  /**
   * Reset per-user Zustand slices on auth transition (sign-out, account
   * switch). Device-scoped fields (settings, flags, ui, onboarding,
   * authState) are deliberately preserved.
   */
  resetForAuth: () => void;
};

export type AuthUiState =
  | { status: "unknown" }
  | { status: "unconfigured" }
  | { status: "signed-out" }
  | {
      status: "signed-in";
      identity: {
        userId: string;
        email: string | null;
        displayName: string | null;
        avatarUrl: string | null;
      };
    };

/**
 * Wire shape emitted by the background sync engine's SYNC_CONFLICT
 * event — these are the only fields we track now that the dialog is
 * gone (see SyncConflictToast).
 */
export type SyncConflictEventIngest = {
  treeId: string;
  serverUpdatedAt: string;
  serverDeviceId: string;
};

export type SyncConflictUiState = {
  treeId: string;
  serverUpdatedAt: string;
  serverDeviceId: string;
  /** Open flag — banner opens the dialog; dialog closes it. */
  dialogOpen: boolean;
  /**
   * Populated after the first successful `fetchConflictPreview`.
   * Null while loading / before first open.
   */
  preview: ConflictPreview | null;
  /**
   * Set when a newer SYNC_CONFLICT fires for the same tree while the
   * dialog is open. Surfaces a non-dismissible banner inside the dialog
   * with a refresh button; picks are preserved. Applies belt-and-braces
   * with the TOCTOU re-check in `applyConflictMergeInternal`.
   */
  stale: boolean;
  /**
   * User's per-node cherry-picks for `(treeId, serverUpdatedAt)`. Also
   * persisted to `conflictPicksItem` (session storage) so sidepanel
   * unmount/remount preserves picks.
   */
  picks: ConflictPickState;
  /**
   * Captured at dialog open — used to detect active-tree switches
   * mid-resolution. null when the dialog was opened against a stored tree.
   */
  expectedActiveTreeId: string | null;
  /** Last apply failure for inline error rendering. Cleared on retry. */
  applyError: ApplyError | null;
};

type PopupKey = keyof StoreState["ui"];

const closeUiPopups = (ui: StoreState["ui"]): StoreState["ui"] => ({
  ...ui,
  settingsOpen: false,
  themePickerOpen: false,
  pinnedOpen: false,
  treesOpen: false,
  tagFilterOpen: false,
});

const openUiPopup = (ui: StoreState["ui"], key: PopupKey): StoreState["ui"] => ({
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

/** Drop IDs no longer present in the tree — for sets that don't care about child count. */
const prunePresentIds = (tree: NavigationTree | null, ids: Set<NodeId>): Set<NodeId> => {
  if (!tree || ids.size === 0) return new Set<NodeId>();
  const next = new Set<NodeId>();
  ids.forEach((id) => {
    if (tree.findNodeById(id)) next.add(id);
  });
  return next;
};

export const useStore = create<StoreState & StoreActions>((set, _get) => ({
  settings: null,
  flags: null,
  tree: null,
  treeJSON: null,
  precomputedPositions: null,
  treeUpdate: null,
  trees: {
    active: null,
    others: [],
  },
  pins: null,
  tabStates: {},
  nodeTabCounts: {},
  nodeRecency: {},
  openNodeIds: new Set<NodeId>(),
  currentNodeId: null,
  nodeCount: 0,
  commandState: null,
  tagFilter: {
    selected: new Set<Tag>(),
  },
  search: {
    query: "",
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
  ui: {
    settingsOpen: false,
    themePickerOpen: false,
    pinnedOpen: false,
    treesOpen: false,
    tagFilterOpen: false,
  },
  graph: {
    tool: "select",
    selectedNodeIds: new Set<NodeId>(),
    view: { translateX: 0, translateY: 0, scale: 1 },
    resetVersion: 0,
    viewIntent: null,
    hoverNodeId: null,
    collapsedNodeIds: new Set<NodeId>(),
    collapsedByTree: new Map<NodeId, Set<NodeId>>(),
    collapseVersion: 0,
    collapseAction: null,
    unfoldedChainIds: new Set<NodeId>(),
    unfoldedChainsByTree: new Map<NodeId, Set<NodeId>>(),
    badgeExpandedIds: new Set<NodeId>(),
    badgeExpandedByTree: new Map<NodeId, Set<NodeId>>(),
  },
  syncStatus: "idle" as SyncStatus,
  commandPalette: { open: false },
  renameTarget: null,
  authState: { status: "unknown" as const },
  syncConflict: null,
  contextMenu: null,
  pickTarget: null,
  onboarding: {
    phase: null,
    wizardStep: 0,
    persona: null,
    startedAt: null,
    completedAt: null,
  },

  bootstrapGraph: (settings, payload) => {
    const tree = NavigationTreeMapper.fromJSON(payload.tree);
    const pins = new PinnedManager(tree);
    const currentId = tree.getCurrentId();
    const nodeCount = tree.size();
    set({
      settings,
      tree,
      treeJSON: payload.tree,
      precomputedPositions: payload.positions ?? null,
      treeUpdate: { reason: payload.reason, at: Date.now() },
      pins,
      tabStates: payload.tabStates,
      nodeTabCounts: payload.nodeTabCounts,
      nodeRecency: payload.nodeRecency ?? {},
      openNodeIds: new Set(payload.openNodeIds),
      currentNodeId: currentId,
      nodeCount,
    });
  },

  applyTreeState: (payload) => {
    const tree = NavigationTreeMapper.fromJSON(payload.tree);
    const pins = new PinnedManager(tree);
    const currentId = tree.getCurrentId();
    const nodeCount = tree.size();
    set((state) => {
      // viewIntent is a one-shot signal from the background: "focus
      // this node now". Do NOT carry the previous view forward when
      // the new payload omits one — that leak caused unrelated tree
      // updates (a background tab refreshing) to re-focus/zoom the
      // graph to a stale target (#87). If the new payload has a
      // view, use it; otherwise clear.
      const resolvedViewIntent = payload.view ?? null;
      const shouldResetTransient =
        payload.reason === "tree-switch" || payload.reason === "tree-reset";
      // Save/restore per-tree collapse state on tree-switch
      let nextCollapsedByTree = state.graph.collapsedByTree;
      let nextCollapsedNodeIds: Set<NodeId>;
      let nextUnfoldedChainsByTree = state.graph.unfoldedChainsByTree;
      let nextUnfoldedChainIds: Set<NodeId>;
      let nextBadgeExpandedByTree = state.graph.badgeExpandedByTree;
      let nextBadgeExpandedIds: Set<NodeId>;
      if (shouldResetTransient) {
        const oldRootId = state.tree?.getRoot()?.id;
        if (oldRootId && state.graph.collapsedNodeIds.size > 0) {
          nextCollapsedByTree = new Map(nextCollapsedByTree);
          nextCollapsedByTree.set(oldRootId, state.graph.collapsedNodeIds);
        }
        if (oldRootId && state.graph.unfoldedChainIds.size > 0) {
          nextUnfoldedChainsByTree = new Map(nextUnfoldedChainsByTree);
          nextUnfoldedChainsByTree.set(oldRootId, state.graph.unfoldedChainIds);
        }
        if (oldRootId && state.graph.badgeExpandedIds.size > 0) {
          nextBadgeExpandedByTree = new Map(nextBadgeExpandedByTree);
          nextBadgeExpandedByTree.set(oldRootId, state.graph.badgeExpandedIds);
        }
        const newRootId = tree.getRoot()?.id;
        const saved = newRootId ? nextCollapsedByTree.get(newRootId) : undefined;
        nextCollapsedNodeIds = saved ? pruneCollapsedNodes(tree, saved) : new Set<NodeId>();
        const savedUnfolded = newRootId ? nextUnfoldedChainsByTree.get(newRootId) : undefined;
        nextUnfoldedChainIds = savedUnfolded
          ? prunePresentIds(tree, savedUnfolded)
          : new Set<NodeId>();
        const savedBadge = newRootId ? nextBadgeExpandedByTree.get(newRootId) : undefined;
        nextBadgeExpandedIds = savedBadge ? prunePresentIds(tree, savedBadge) : new Set<NodeId>();
      } else {
        nextCollapsedNodeIds = pruneCollapsedNodes(tree, state.graph.collapsedNodeIds);
        nextUnfoldedChainIds = prunePresentIds(tree, state.graph.unfoldedChainIds);
        nextBadgeExpandedIds = prunePresentIds(tree, state.graph.badgeExpandedIds);
      }
      const autoExpandIds: NodeId[] = shouldResetTransient ? [] : [];
      const collapseVersion =
        autoExpandIds.length > 0 ? state.graph.collapseVersion + 1 : state.graph.collapseVersion;
      const collapseAction =
        autoExpandIds.length > 0
          ? ({ kind: "expand", nodeIds: new Set<NodeId>(autoExpandIds) } as const)
          : state.graph.collapseAction;
      if (autoExpandIds.length > 0) {
        autoExpandIds.forEach((id) => nextCollapsedNodeIds.delete(id));
      }
      // Prune transient single-target state (rename / pick) when the
      // target node disappears from the new tree — covers cases where
      // another device deleted the node mid-rename, or the local user
      // undoes back through it. Without this the rename input renders
      // for a no-longer-existing node.
      const treeContains = (id: NodeId | null) => Boolean(id && tree.findNodeById(id));
      const nextRenameTarget = treeContains(state.renameTarget) ? state.renameTarget : null;
      const nextPickTarget =
        state.pickTarget && treeContains(state.pickTarget.sourceNodeId) ? state.pickTarget : null;

      // Selection: prune ids that vanished from the tree on EVERY apply
      // (not just tree-switch). A remote delete or local node-delete
      // shrinks the tree underneath us; stale ids in the Set would
      // confuse downstream consumers (BulkContextMenu, SelectionActionBar).
      const prunedSelection = shouldResetTransient
        ? new Set<NodeId>()
        : prunePresentIds(tree, state.graph.selectedNodeIds);

      const nextGraph = {
        ...state.graph,
        viewIntent: resolvedViewIntent,
        collapsedNodeIds: nextCollapsedNodeIds,
        collapsedByTree: nextCollapsedByTree,
        unfoldedChainIds: nextUnfoldedChainIds,
        unfoldedChainsByTree: nextUnfoldedChainsByTree,
        badgeExpandedIds: nextBadgeExpandedIds,
        badgeExpandedByTree: nextBadgeExpandedByTree,
        collapseVersion,
        collapseAction,
        selectedNodeIds: prunedSelection,
        ...(shouldResetTransient
          ? {
              hoverNodeId: null,
              collapseAction: null,
            }
          : {}),
      };
      return {
        tree,
        treeJSON: payload.tree,
        precomputedPositions: payload.positions ?? null,
        treeUpdate: { reason: payload.reason, at: Date.now() },
        pins,
        tabStates: payload.tabStates,
        nodeTabCounts: payload.nodeTabCounts,
        nodeRecency: payload.nodeRecency ?? {},
        openNodeIds: new Set(payload.openNodeIds),
        currentNodeId: currentId,
        nodeCount,
        renameTarget: nextRenameTarget,
        pickTarget: nextPickTarget,
        graph: nextGraph,
        ...(shouldResetTransient
          ? {
              search: {
                query: "",
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
        others: snapshot.others,
      },
    }),
  setCommandState: (state) => set({ commandState: state }),
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
            query: "",
            results: [],
            index: 0,
            navStep: 0,
            active: false,
            baseCurrentId: null,
          },
        };
      }
      const base = baseCurrentId ?? state.search.baseCurrentId ?? state.currentNodeId ?? null;
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
          ...(results.length > 0 ? { active: true } : {}),
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
        query: "",
        results: [],
        index: 0,
        navStep: 0,
        active: false,
        baseCurrentId: null,
      },
    }),

  setSettings: (settings) =>
    set((state) => {
      const positionsInvalid =
        state.settings &&
        (state.settings.layout.mode !== settings.layout.mode ||
          state.settings.graphDensity !== settings.graphDensity);
      return {
        settings,
        ...(positionsInvalid ? { precomputedPositions: null } : {}),
      };
    }),
  setFlags: (flags) => set({ flags }),
  setSettingsOpen: (open) =>
    set((state) =>
      open
        ? { ui: openUiPopup(state.ui, "settingsOpen"), contextMenu: null }
        : { ui: { ...state.ui, settingsOpen: false } },
    ),
  setThemePickerOpen: (open) =>
    set((state) =>
      open
        ? { ui: openUiPopup(state.ui, "themePickerOpen"), contextMenu: null }
        : { ui: { ...state.ui, themePickerOpen: false } },
    ),
  setPinnedOpen: (open) =>
    set((state) =>
      open
        ? { ui: openUiPopup(state.ui, "pinnedOpen"), contextMenu: null }
        : { ui: { ...state.ui, pinnedOpen: false } },
    ),
  setTreesOpen: (open) =>
    set((state) =>
      open
        ? { ui: openUiPopup(state.ui, "treesOpen"), contextMenu: null }
        : { ui: { ...state.ui, treesOpen: false } },
    ),
  setTagFilterOpen: (open) =>
    set((state) =>
      open
        ? { ui: openUiPopup(state.ui, "tagFilterOpen"), contextMenu: null }
        : { ui: { ...state.ui, tagFilterOpen: false } },
    ),
  closeAllPopups: () => set((state) => ({ ui: closeUiPopups(state.ui), contextMenu: null })),
  registerOverlay: (id, effects) =>
    set((state) => {
      const prev = state.overlayEffects.entries[id];
      if (
        prev &&
        prev.lod === effects.lod &&
        prev.blur === effects.blur &&
        prev.kind === effects.kind
      ) {
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
      const nextBadge = new Set(state.graph.badgeExpandedIds);
      const changed: NodeId[] = [];
      let badgeChanged = false;
      nodeIds.forEach((id) => {
        // Any collapse path clears the badge-expand affordance.
        if (nextBadge.delete(id)) badgeChanged = true;
        if (next.has(id)) return;
        next.add(id);
        changed.push(id);
      });
      if (changed.length === 0 && !badgeChanged) return state;
      return {
        precomputedPositions: null,
        graph: {
          ...state.graph,
          collapsedNodeIds: next,
          badgeExpandedIds: nextBadge,
          collapseVersion:
            changed.length > 0 ? state.graph.collapseVersion + 1 : state.graph.collapseVersion,
          collapseAction:
            changed.length > 0
              ? { kind: "collapse", nodeIds: new Set(changed) }
              : state.graph.collapseAction,
        },
      };
    }),
  expandNodes: (nodeIds) =>
    set((state) => {
      if (nodeIds.length === 0) return state;
      const next = new Set(state.graph.collapsedNodeIds);
      const nextBadge = new Set(state.graph.badgeExpandedIds);
      const changed: NodeId[] = [];
      let badgeChanged = false;
      nodeIds.forEach((id) => {
        // Regular expand (not via badge) wipes any prior badge state —
        // user shouldn't see the down-arrow after a context-menu Expand.
        if (nextBadge.delete(id)) badgeChanged = true;
        if (!next.has(id)) return;
        next.delete(id);
        changed.push(id);
      });
      if (changed.length === 0 && !badgeChanged) return state;
      return {
        precomputedPositions: null,
        graph: {
          ...state.graph,
          collapsedNodeIds: next,
          badgeExpandedIds: nextBadge,
          collapseVersion:
            changed.length > 0 ? state.graph.collapseVersion + 1 : state.graph.collapseVersion,
          collapseAction:
            changed.length > 0
              ? { kind: "expand", nodeIds: new Set(changed) }
              : state.graph.collapseAction,
        },
      };
    }),
  toggleChainUnfolded: (nodeId) =>
    set((state) => {
      const next = new Set(state.graph.unfoldedChainIds);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return {
        // Positions depend on fold info, which depends on this set —
        // drop the cached snapshot so d3 recomputes with the new shape.
        precomputedPositions: null,
        graph: { ...state.graph, unfoldedChainIds: next },
      };
    }),
  toggleBadgeCollapse: (nodeId) =>
    set((state) => {
      const collapsed = new Set(state.graph.collapsedNodeIds);
      const badge = new Set(state.graph.badgeExpandedIds);
      let kind: "collapse" | "expand";
      if (collapsed.has(nodeId)) {
        // Currently collapsed — expand and remember it was via badge so
        // the TrailNode can render the re-collapse arrow.
        collapsed.delete(nodeId);
        badge.add(nodeId);
        kind = "expand";
      } else if (badge.has(nodeId)) {
        // Currently expanded via badge — re-collapse and clear the flag.
        collapsed.add(nodeId);
        badge.delete(nodeId);
        kind = "collapse";
      } else {
        return state;
      }
      return {
        precomputedPositions: null,
        graph: {
          ...state.graph,
          collapsedNodeIds: collapsed,
          badgeExpandedIds: badge,
          collapseVersion: state.graph.collapseVersion + 1,
          collapseAction: { kind, nodeIds: new Set([nodeId]) },
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
  setPickTarget: (pickTarget) => set({ pickTarget }),
  clearPickTarget: () => set({ pickTarget: null }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setCommandPaletteOpen: (open) => set({ commandPalette: { open } }),
  startInlineRename: (nodeId) => set({ renameTarget: nodeId }),
  cancelInlineRename: () => set({ renameTarget: null }),
  setAuthState: (authState) => set({ authState }),

  /**
   * Accept a SYNC_CONFLICT event (null clears). Re-entrancy semantics:
   *
   * - null → clear everything.
   * - same `treeId` + same `serverUpdatedAt` as current → duplicate event,
   *   no-op (preserves in-flight dialog state).
   * - same `treeId`, DIFFERENT `serverUpdatedAt`, dialog is open → mark
   *   `stale: true`, preserve `preview` + `picks` so the user doesn't
   *   lose their cherry-picks. The dialog surfaces a refresh CTA.
   * - same `treeId`, DIFFERENT `serverUpdatedAt`, dialog is closed → swap
   *   in fresh conflict, reset picks + preview.
   * - different `treeId` (or no current conflict) → fresh slice.
   */
  setSyncConflict: (next) =>
    set((state) => {
      if (next === null) {
        return { syncConflict: null };
      }
      if (isCompleteConflictState(next)) {
        return { syncConflict: next };
      }
      const cur = state.syncConflict;
      if (cur && cur.treeId === next.treeId) {
        if (cur.serverUpdatedAt === next.serverUpdatedAt) {
          return state; // duplicate event
        }
        if (cur.dialogOpen) {
          return {
            syncConflict: {
              ...cur,
              serverDeviceId: next.serverDeviceId,
              serverUpdatedAt: next.serverUpdatedAt,
              stale: true,
            },
          };
        }
      }
      return {
        syncConflict: {
          treeId: next.treeId,
          serverUpdatedAt: next.serverUpdatedAt,
          serverDeviceId: next.serverDeviceId,
          dialogOpen: false,
          preview: null,
          stale: false,
          picks: emptyConflictPicks(next.treeId, next.serverUpdatedAt),
          expectedActiveTreeId: null,
          applyError: null,
        },
      };
    }),

  setConflictDialogOpen: (open, expectedActiveTreeId = null) =>
    set((state) => {
      if (!state.syncConflict) return state;
      return {
        syncConflict: {
          ...state.syncConflict,
          dialogOpen: open,
          expectedActiveTreeId: open
            ? expectedActiveTreeId
            : state.syncConflict.expectedActiveTreeId,
          applyError: open ? state.syncConflict.applyError : null,
        },
      };
    }),

  setConflictPreview: (preview) =>
    set((state) => {
      if (!state.syncConflict) return state;
      return {
        syncConflict: {
          ...state.syncConflict,
          preview,
          stale: false,
        },
      };
    }),

  setConflictStale: (stale) =>
    set((state) => {
      if (!state.syncConflict) return state;
      return { syncConflict: { ...state.syncConflict, stale } };
    }),

  setConflictNodePick: (nodeId, pick) =>
    set((state) => {
      if (!state.syncConflict) return state;
      return {
        syncConflict: {
          ...state.syncConflict,
          picks: {
            ...state.syncConflict.picks,
            nodePicks: {
              ...state.syncConflict.picks.nodePicks,
              [nodeId]: pick,
            },
          },
        },
      };
    }),

  setConflictStructuralPick: (nodeId, pick) =>
    set((state) => {
      if (!state.syncConflict) return state;
      return {
        syncConflict: {
          ...state.syncConflict,
          picks: {
            ...state.syncConflict.picks,
            structuralPicks: {
              ...state.syncConflict.picks.structuralPicks,
              [nodeId]: pick,
            },
          },
        },
      };
    }),

  setConflictLabelPick: (labelPick) =>
    set((state) => {
      if (!state.syncConflict) return state;
      return {
        syncConflict: {
          ...state.syncConflict,
          picks: { ...state.syncConflict.picks, labelPick },
        },
      };
    }),

  setConflictReorderPick: (parentId, order) =>
    set((state) => {
      if (!state.syncConflict) return state;
      return {
        syncConflict: {
          ...state.syncConflict,
          picks: {
            ...state.syncConflict.picks,
            reorderPicks: {
              ...state.syncConflict.picks.reorderPicks,
              [parentId]: order,
            },
          },
        },
      };
    }),

  resetConflictPicks: () =>
    set((state) => {
      if (!state.syncConflict) return state;
      return {
        syncConflict: {
          ...state.syncConflict,
          picks: emptyConflictPicks(state.syncConflict.treeId, state.syncConflict.serverUpdatedAt),
        },
      };
    }),

  setConflictApplyError: (applyError) =>
    set((state) => {
      if (!state.syncConflict) return state;
      return { syncConflict: { ...state.syncConflict, applyError } };
    }),

  clearConflict: () => set({ syncConflict: null }),

  setOnboarding: (patch) =>
    set((state) => ({
      onboarding: {
        ...state.onboarding,
        ...patch,
      },
    })),

  resetForAuth: () =>
    set({
      tree: null,
      treeJSON: null,
      precomputedPositions: null,
      treeUpdate: null,
      trees: { active: null, others: [] },
      pins: null,
      tabStates: {},
      nodeTabCounts: {},
      nodeRecency: {},
      openNodeIds: new Set<NodeId>(),
      currentNodeId: null,
      nodeCount: 0,
      commandState: null,
      tagFilter: { selected: new Set<Tag>() },
      search: {
        query: "",
        results: [],
        index: 0,
        navStep: 0,
        active: false,
        baseCurrentId: null,
      },
      graph: {
        tool: "select" as GraphTool,
        selectedNodeIds: new Set<NodeId>(),
        view: { translateX: 0, translateY: 0, scale: 1 },
        resetVersion: 0,
        viewIntent: null,
        hoverNodeId: null,
        collapsedNodeIds: new Set<NodeId>(),
        collapsedByTree: new Map<NodeId, Set<NodeId>>(),
        collapseVersion: 0,
        collapseAction: null,
        unfoldedChainIds: new Set<NodeId>(),
        unfoldedChainsByTree: new Map<NodeId, Set<NodeId>>(),
        badgeExpandedIds: new Set<NodeId>(),
        badgeExpandedByTree: new Map<NodeId, Set<NodeId>>(),
      },
      syncConflict: null,
      renameTarget: null,
      pickTarget: null,
      contextMenu: null,
    }),
}));

function emptyConflictPicks(treeId: string, serverUpdatedAt: string): ConflictPickState {
  return {
    treeId,
    serverUpdatedAt,
    nodePicks: {},
    structuralPicks: {},
    labelPick: null,
    reorderPicks: {},
  };
}

function isCompleteConflictState(value: unknown): value is SyncConflictUiState {
  return typeof value === "object" && value !== null && "dialogOpen" in value && "picks" in value;
}
