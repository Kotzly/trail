import { useEffect } from "react";
import { tinykeys, type KeyBindingMap } from "tinykeys";
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
type Ctx = { event: KeyboardEvent; state: Store };
type WhenFn = (ctx: Ctx) => boolean;
type RunFn = (ctx: Ctx) => void | Promise<void>;

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
};

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

// ── Wiring ──────────────────────────────────────────────────────────

const whenNotInEditor: WhenFn = ({ state }) => !state.editorMode.active;
const always: WhenFn = () => true;
const whenNotOverlayOrEditor: WhenFn = ({ state }) =>
  !state.editorMode.active && !overlayOpen(state);

/**
 * Wrap a handler with the global gating: skip when typing in an input,
 * skip when settings disable shortcuts, evaluate `when`, then
 * preventDefault + run.
 */
function gate(run: RunFn, when: WhenFn = whenNotInEditor): (event: KeyboardEvent) => void {
  return (event) => {
    if (event.defaultPrevented) return;
    if (isEditableTarget(event.target)) return;
    const state = useStore.getState();
    if (state.settings && state.settings.shortcutsEnabled === false) return;
    const ctx: Ctx = { event, state };
    if (!when(ctx)) return;
    event.preventDefault();
    void run(ctx);
  };
}

function buildBindings(): KeyBindingMap {
  const openPalette: RunFn = ({ state }) => state.setCommandPaletteOpen(true);
  const escape: RunFn = ({ state }) => {
    if (state.editorMode.active) {
      exitEditorMode().catch((error) => console.error("Failed to exit editor:", error));
      return;
    }
    state.closeAllPopups();
    state.closeContextMenu();
    state.clearSelection();
    state.clearSearch();
  };

  return {
    // Undo / redo
    "$mod+KeyZ": gate(async ({ state }) => {
      if (!(state.commandState?.canUndo ?? false)) return;
      try {
        state.setCommandState(await undo());
      } catch (error) {
        console.error("Failed to undo:", error);
      }
    }),
    "$mod+Shift+KeyZ": gate(async ({ state }) => {
      if (!(state.commandState?.canRedo ?? false)) return;
      try {
        state.setCommandState(await redo());
      } catch (error) {
        console.error("Failed to redo:", error);
      }
    }),
    // Ctrl+Y on non-mac only — Cmd+Y is "History" on macOS so skip there.
    "$mod+KeyY": gate(
      async ({ state }) => {
        if (!(state.commandState?.canRedo ?? false)) return;
        try {
          state.setCommandState(await redo());
        } catch (error) {
          console.error("Failed to redo:", error);
        }
      },
      ({ state }) => !state.isMac && !state.editorMode.active,
    ),

    // Command palette / search
    "$mod+KeyF": gate(openPalette),
    "$mod+KeyK": gate(openPalette),
    Slash: gate(openPalette),

    // F2 rename
    F2: gate(({ state }) => {
      const ids = getTargetNodeIds(state);
      if (ids.length === 1 && ids[0]) state.openRenameDialog(ids[0]);
    }),

    // Settings page
    "$mod+Comma": gate(() => openHubPage()),

    // Select all / clear selection
    "$mod+KeyA": gate(({ state }) => selectAllNodes(state)),
    "$mod+Shift+KeyA": gate(({ state }) => state.clearSelection()),

    // Escape — exit editor or close overlays
    Escape: gate(escape, always),

    // Overlays
    "Shift+KeyP": gate(({ state }) => state.setPinnedOpen(!state.ui.pinnedOpen)),
    "Shift+KeyT": gate(({ state }) => state.setTreesOpen(!state.ui.treesOpen), always),
    "Shift+KeyF": gate(({ state }) => state.setTagFilterOpen(!state.ui.tagFilterOpen)),
    "Shift+KeyL": gate(({ state }) => cycleLayoutMode(state), always),
    "Shift+KeyC": gate(({ state }) => toggleConnections(state), always),

    // Pin toggle (plain P)
    KeyP: gate(({ state }) => togglePinned(state, getTargetNodeIds(state)), whenNotOverlayOrEditor),

    // Enter — open in current tab
    Enter: gate(
      async ({ state }) => {
        if (state.editorMode.active) return;
        await openFocusedNode(state);
      },
      ({ state }) => !overlayOpen(state),
    ),
    // Cmd+Enter — open in new tabs
    "$mod+Enter": gate(({ state }) => {
      if (state.editorMode.active) return;
      getTargetNodeIds(state).forEach((nodeId) =>
        fireAndForget(openInNewTab(nodeId), "open in new tab"),
      );
    }, always),

    // Delete / Backspace — single key + Shift variant for recursive
    Delete: gate(
      ({ event, state }) => deleteNodes(state, getTargetNodeIds(state), event.shiftKey),
      whenNotOverlayOrEditor,
    ),
    Backspace: gate(
      ({ event, state }) => deleteNodes(state, getTargetNodeIds(state), event.shiftKey),
      whenNotOverlayOrEditor,
    ),
    "Shift+Delete": gate(
      ({ state }) => deleteNodes(state, getTargetNodeIds(state), true),
      whenNotOverlayOrEditor,
    ),
    "Shift+Backspace": gate(
      ({ state }) => deleteNodes(state, getTargetNodeIds(state), true),
      whenNotOverlayOrEditor,
    ),

    // Arrow navigation
    ArrowUp: gate(({ state }) => moveFocus(state, "parent"), whenNotOverlayOrEditor),
    ArrowDown: gate(({ state }) => moveFocus(state, "child"), whenNotOverlayOrEditor),
    ArrowLeft: gate(({ state }) => moveFocus(state, "prev"), whenNotOverlayOrEditor),
    ArrowRight: gate(({ state }) => moveFocus(state, "next"), whenNotOverlayOrEditor),
  };
}

export function useShortcuts(): void {
  useEffect(() => {
    return tinykeys(window, buildBindings());
  }, []);
}
