import { useEffect } from "react";
import type { NodeId } from "@shared/types/ids.js";
import type { LayoutMode } from "@shared/types/settings.js";
import { browser } from "@shared/platform/webext.js";
import { redo, undo } from "../../api/commands.js";
import { navigateTo, setCurrentNode } from "../../api/tree.js";
import { saveSettings } from "../../api/settings.js";
import {
  bulkDeleteNodes,
  bulkDeleteRecursive,
  bulkPin,
  bulkUnpin,
  deleteNode,
  deleteWithChildren,
  exitEditorMode,
  fireAndForget,
  openInNewTab,
  togglePin,
} from "../../api/actions.js";
import { useStore } from "../state/store.js";
import { getIncludedRootId } from "../shared/delete-tree.js";

type Store = ReturnType<typeof useStore.getState>;

type Match = {
  /** cmd on mac, ctrl on others. Undefined = must not be pressed. */
  mod?: boolean;
  alt?: boolean;
  /** ctrl key specifically — separate from `mod` on macOS. */
  ctrl?: boolean;
  shift?: boolean;
  /** Matches `event.code` (layout-independent). */
  code?: string;
  /** Matches `event.key` (layout-dependent, useful for Enter/Escape/Arrow*). */
  key?: string;
};

type Ctx = { event: KeyboardEvent; state: Store };
type Shortcut = {
  match: Match | Match[];
  /** Run condition. Defaults to: not in editor mode. */
  when?: (ctx: Ctx) => boolean;
  run: (ctx: Ctx) => void | Promise<void>;
  /** Skip preventDefault (rare). */
  passive?: boolean;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
};

function matches(event: KeyboardEvent, spec: Match, isMac: boolean): boolean {
  const mod = isMac ? event.metaKey : event.ctrlKey;
  const ctrl = isMac ? event.ctrlKey : false;
  if ((spec.mod ?? false) !== mod) return false;
  if ((spec.alt ?? false) !== event.altKey) return false;
  if ((spec.ctrl ?? false) !== ctrl) return false;
  if (spec.shift !== undefined && spec.shift !== event.shiftKey) return false;
  if (spec.code && spec.code !== event.code) return false;
  if (spec.key && spec.key !== event.key) return false;
  return true;
}

// ── Helpers ─────────────────────────────────────────────────────────

const getFocusBaseId = (state: Store): NodeId | null => {
  if (state.graph.selectedNodeIds.size === 1) {
    return Array.from(state.graph.selectedNodeIds)[0] ?? null;
  }
  if (state.graph.hoverNodeId) return state.graph.hoverNodeId;
  if (state.currentNodeId) return state.currentNodeId;
  return state.tree?.getRoot?.()?.id ?? null;
};

const getTargetNodeIds = (state: Store): NodeId[] => {
  if (state.graph.selectedNodeIds.size > 0) return Array.from(state.graph.selectedNodeIds);
  if (state.graph.hoverNodeId) return [state.graph.hoverNodeId];
  if (state.currentNodeId) return [state.currentNodeId];
  return [];
};

const overlayOpen = (state: Store) =>
  state.ui.pinnedOpen || state.ui.treesOpen || state.ui.tagFilterOpen || Boolean(state.contextMenu);

async function moveFocus(state: Store, direction: "parent" | "child" | "prev" | "next") {
  const tree = state.tree;
  if (!tree) return;
  const baseId = getFocusBaseId(state);
  if (!baseId) return;
  const node = tree.findNodeById(baseId);
  if (!node) return;

  let next: { id: NodeId } | null = null;
  if (direction === "parent") next = node.getParent?.() ?? null;
  else if (direction === "child") next = node.getChildren?.()[0] ?? null;
  else {
    const parent = node.getParent?.() ?? null;
    if (!parent) return;
    const siblings = parent.getChildren?.() ?? [];
    const idx = siblings.findIndex((entry) => entry.id === node.id);
    if (idx === -1) return;
    const target =
      direction === "prev"
        ? idx > 0
          ? siblings[idx - 1]
          : null
        : idx < siblings.length - 1
          ? siblings[idx + 1]
          : null;
    next = target ?? null;
  }
  if (!next) return;
  try {
    await setCurrentNode(next.id);
  } catch (error) {
    console.error("Failed to set current node:", error);
  }
}

function togglePinned(state: Store, nodeIds: NodeId[]) {
  const tree = state.tree;
  if (!tree || nodeIds.length === 0) return;
  if (nodeIds.length === 1) {
    const [nodeId] = nodeIds;
    if (nodeId) fireAndForget(togglePin(nodeId), "toggle pin");
    return;
  }
  const nodes = nodeIds.map((id) => tree.findNodeById(id)).filter(Boolean);
  if (nodes.length === 0) return;
  const allPinned = nodes.every((node) => node?.data.pinned);
  fireAndForget(allPinned ? bulkUnpin(nodeIds) : bulkPin(nodeIds), "bulk pin toggle");
}

function deleteNodes(state: Store, nodeIds: NodeId[], recursive: boolean) {
  if (nodeIds.length === 0) return;
  const rootId = getIncludedRootId(state.tree, nodeIds);
  if (rootId) {
    state.openDeleteTreeConfirm(rootId);
    return;
  }
  if (nodeIds.length === 1) {
    const [nodeId] = nodeIds;
    if (!nodeId) return;
    fireAndForget(
      recursive ? deleteWithChildren(nodeId) : deleteNode(nodeId),
      recursive ? "delete subtree" : "delete node",
    );
  } else {
    fireAndForget(
      recursive ? bulkDeleteRecursive(nodeIds) : bulkDeleteNodes(nodeIds),
      recursive ? "bulk delete recursive" : "bulk delete nodes",
    );
  }
  state.clearSelection();
  state.closeContextMenu();
}

function selectAllNodes(state: Store) {
  const tree = state.tree;
  if (!tree) return;
  const ids = new Set<NodeId>();
  for (const node of tree.iter()) ids.add(node.id);
  state.setSelectedNodeIds(ids);
}

function cycleLayoutMode(state: Store) {
  if (!state.settings) return;
  const order: LayoutMode[] = ["tree", "mindmap"];
  const current = state.settings.layout.mode ?? "tree";
  const next = order[(order.indexOf(current) + 1) % order.length] ?? "tree";
  const nextSettings = { ...state.settings, layout: { ...state.settings.layout, mode: next } };
  state.setSettings(nextSettings);
  void saveSettings(nextSettings);
}

function toggleConnections(state: Store) {
  if (!state.settings) return;
  const nextSettings = { ...state.settings, showConnections: !state.settings.showConnections };
  state.setSettings(nextSettings);
  void saveSettings(nextSettings);
}

function openHubPage() {
  const url = chrome.runtime.getURL("settings.html");
  browser.tabs.create({ url, active: true }).catch((error) => {
    console.error("Failed to open hub page:", error);
  });
}

async function openFocusedNode(state: Store) {
  const tree = state.tree;
  const [firstId] = getTargetNodeIds(state);
  if (!tree || !firstId) return;
  const node = tree.findNodeById(firstId);
  if (!node) return;
  try {
    await navigateTo(node);
  } catch (error) {
    console.error("Failed to navigate:", error);
  }
}

// ── Shortcut table ──────────────────────────────────────────────────

const whenNotInEditor: Shortcut["when"] = ({ state }) => !state.editorMode.active;

const SHORTCUTS: Shortcut[] = [
  // Undo / redo
  {
    match: { mod: true, code: "KeyZ", shift: false },
    run: async ({ state }) => {
      if (!(state.commandState?.canUndo ?? false)) return;
      try {
        state.setCommandState(await undo());
      } catch (error) {
        console.error("Failed to undo:", error);
      }
    },
  },
  {
    match: [
      { mod: true, code: "KeyZ", shift: true },
      // Ctrl+Y on non-Mac only — handled via explicit check in `when`
      { mod: true, code: "KeyY", shift: false },
    ],
    when: ({ event, state }) => !(event.code === "KeyY" && state.isMac),
    run: async ({ state }) => {
      if (!(state.commandState?.canRedo ?? false)) return;
      try {
        state.setCommandState(await redo());
      } catch (error) {
        console.error("Failed to redo:", error);
      }
    },
  },
  // Command palette / search
  {
    match: [{ mod: true, code: "KeyF" }, { mod: true, code: "KeyK" }, { code: "Slash" }],
    run: ({ state }) => {
      state.setCommandPaletteOpen(true);
    },
  },
  // F2 rename
  {
    match: { code: "F2" },
    run: ({ state }) => {
      const ids = getTargetNodeIds(state);
      if (ids.length === 1 && ids[0]) state.openRenameDialog(ids[0]);
    },
  },
  // Settings page
  {
    match: { mod: true, code: "Comma" },
    run: () => openHubPage(),
  },
  // Select all / clear selection
  {
    match: { mod: true, code: "KeyA", shift: false },
    run: ({ state }) => selectAllNodes(state),
  },
  {
    match: { mod: true, code: "KeyA", shift: true },
    run: ({ state }) => state.clearSelection(),
  },
  // Escape — exit editor OR close overlays
  {
    match: { key: "Escape" },
    when: () => true, // always active (including editor)
    run: ({ state }) => {
      if (state.editorMode.active) {
        exitEditorMode().catch((error) => console.error("Failed to exit editor:", error));
        return;
      }
      state.closeAllPopups();
      state.closeContextMenu();
      state.clearSelection();
      state.clearSearch();
    },
  },
  // Overlays (pinned / trees / tag filter / layout / connections)
  {
    match: { code: "KeyP", shift: true },
    when: whenNotInEditor,
    run: ({ state }) => {
      const open = state.ui.pinnedOpen;
      state.setPinnedOpen(!open);
    },
  },
  {
    match: { code: "KeyT", shift: true },
    run: ({ state }) => {
      const open = state.ui.treesOpen;
      state.setTreesOpen(!open);
    },
  },
  {
    match: { code: "KeyF", shift: true },
    when: whenNotInEditor,
    run: ({ state }) => {
      const open = state.ui.tagFilterOpen;
      state.setTagFilterOpen(!open);
    },
  },
  {
    match: { code: "KeyL", shift: true },
    run: ({ state }) => cycleLayoutMode(state),
  },
  {
    match: { code: "KeyC", shift: true },
    run: ({ state }) => toggleConnections(state),
  },
  // Pin toggle (plain P)
  {
    match: { code: "KeyP", shift: false },
    when: ({ state }) => !state.editorMode.active && !overlayOpen(state),
    run: ({ state }) => togglePinned(state, getTargetNodeIds(state)),
  },
  // Enter — open node(s) in current tab
  {
    match: { key: "Enter", shift: false },
    when: ({ state }) => !overlayOpen(state),
    run: async ({ state }) => {
      if (state.editorMode.active) return;
      await openFocusedNode(state);
    },
  },
  // Cmd+Enter — open in new tabs (works in/out of editor, short-circuits in editor)
  {
    match: { key: "Enter", mod: true },
    when: () => true,
    run: ({ state }) => {
      if (state.editorMode.active) return;
      getTargetNodeIds(state).forEach((nodeId) =>
        fireAndForget(openInNewTab(nodeId), "open in new tab"),
      );
    },
  },
  // Delete / Backspace
  {
    match: [
      { key: "Delete", shift: false },
      { key: "Delete", shift: true },
      { key: "Backspace", shift: false },
      { key: "Backspace", shift: true },
    ],
    when: ({ state }) => !state.editorMode.active && !overlayOpen(state),
    run: ({ event, state }) => deleteNodes(state, getTargetNodeIds(state), event.shiftKey),
  },
  // Arrow navigation
  {
    match: { key: "ArrowUp", shift: false },
    when: ({ state }) => !state.editorMode.active && !overlayOpen(state),
    run: ({ state }) => moveFocus(state, "parent"),
  },
  {
    match: { key: "ArrowDown", shift: false },
    when: ({ state }) => !state.editorMode.active && !overlayOpen(state),
    run: ({ state }) => moveFocus(state, "child"),
  },
  {
    match: { key: "ArrowLeft", shift: false },
    when: ({ state }) => !state.editorMode.active && !overlayOpen(state),
    run: ({ state }) => moveFocus(state, "prev"),
  },
  {
    match: { key: "ArrowRight", shift: false },
    when: ({ state }) => !state.editorMode.active && !overlayOpen(state),
    run: ({ state }) => moveFocus(state, "next"),
  },
];

export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;

      const state = useStore.getState();
      if (state.settings && state.settings.shortcutsEnabled === false) return;

      const isMac = state.isMac;

      for (const shortcut of SHORTCUTS) {
        const specs = Array.isArray(shortcut.match) ? shortcut.match : [shortcut.match];
        if (!specs.some((spec) => matches(event, spec, isMac))) continue;

        const ctx: Ctx = { event, state };
        const allowed = shortcut.when ? shortcut.when(ctx) : !state.editorMode.active;
        if (!allowed) continue;

        if (!shortcut.passive) event.preventDefault();
        await shortcut.run(ctx);
        return;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // Intentional empty deps: handler reads live state via useStore.getState()
    // so the listener attaches once for the sidepanel's lifetime.
  }, []);
}
