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

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
};

export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const state = useStore.getState();
      const shortcutsEnabled = state.settings?.shortcutsEnabled ?? true;
      if (!shortcutsEnabled) return;

      const editorActive = state.editorMode.active;

      const isMac = state.isMac;
      const metaKey = isMac ? event.metaKey : event.ctrlKey;
      const key = event.key;
      const code = event.code;
      const isEditable = isEditableTarget(event.target);

      const openCommandPalette = () => {
        state.setCommandPaletteOpen(true);
      };

      const getFocusBaseId = () => {
        if (state.graph.selectedNodeIds.size === 1) {
          return Array.from(state.graph.selectedNodeIds)[0] ?? null;
        }
        if (state.graph.hoverNodeId) return state.graph.hoverNodeId;
        if (state.currentNodeId) return state.currentNodeId;
        const root = state.tree?.getRoot?.();
        return root?.id ?? null;
      };

      const getTargetNodeIds = () => {
        if (state.graph.selectedNodeIds.size > 0) {
          return Array.from(state.graph.selectedNodeIds);
        }
        if (state.graph.hoverNodeId) return [state.graph.hoverNodeId];
        if (state.currentNodeId) return [state.currentNodeId];
        return [];
      };

      const moveFocus = async (direction: "parent" | "child" | "prev" | "next") => {
        const tree = state.tree;
        if (!tree) return;
        const baseId = getFocusBaseId();
        if (!baseId) return;
        const node = tree.findNodeById(baseId);
        if (!node) return;

        let next = null;
        if (direction === "parent") {
          next = node.getParent?.() ?? null;
        } else if (direction === "child") {
          next = node.getChildren?.()[0] ?? null;
        } else {
          const parent = node.getParent?.() ?? null;
          if (!parent) return;
          const siblings = parent.getChildren?.() ?? [];
          const idx = siblings.findIndex((entry) => entry.id === node.id);
          if (idx === -1) return;
          if (direction === "prev") {
            next = idx > 0 ? siblings[idx - 1] : null;
          } else {
            next = idx < siblings.length - 1 ? siblings[idx + 1] : null;
          }
        }

        if (!next) return;
        try {
          await setCurrentNode(next.id);
        } catch (error) {
          console.error("Failed to set current node:", error);
        }
      };

      const openNodes = async (nodeIds: NodeId[]) => {
        const tree = state.tree;
        if (!tree) return;
        const id = nodeIds[0];
        if (!id) return;
        const node = tree.findNodeById(id);
        if (!node) return;
        try {
          await navigateTo(node);
        } catch (error) {
          console.error("Failed to navigate:", error);
        }
      };

      const openNodesInNewTabs = (nodeIds: NodeId[]) => {
        nodeIds.forEach((nodeId) => {
          fireAndForget(openInNewTab(nodeId), "open in new tab");
        });
      };

      const togglePinned = (nodeIds: NodeId[]) => {
        const tree = state.tree;
        if (!tree || nodeIds.length === 0) return;
        if (nodeIds.length === 1) {
          const [nodeId] = nodeIds;
          if (!nodeId) return;
          fireAndForget(togglePin(nodeId), "toggle pin");
          return;
        }
        const nodes = nodeIds.map((id) => tree.findNodeById(id)).filter((node) => Boolean(node));
        if (nodes.length === 0) return;
        const allPinned = nodes.every((node) => node?.data.pinned);
        fireAndForget(allPinned ? bulkUnpin(nodeIds) : bulkPin(nodeIds), "bulk pin toggle");
      };

      const deleteNodes = (nodeIds: NodeId[], recursive: boolean) => {
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
      };

      const selectAllNodes = () => {
        const tree = state.tree;
        if (!tree) return;
        const ids = new Set<NodeId>();
        for (const node of tree.iter()) {
          ids.add(node.id);
        }
        state.setSelectedNodeIds(ids);
      };

      const togglePopup = (key: "pinnedOpen" | "treesOpen" | "tagFilterOpen") => {
        const isOpen = state.ui[key];
        if (key === "pinnedOpen") {
          state.setPinnedOpen(!isOpen);
        } else if (key === "treesOpen") {
          state.setTreesOpen(!isOpen);
        } else {
          state.setTagFilterOpen(!isOpen);
        }
      };

      const openHubPage = () => {
        const url = chrome.runtime.getURL("settings.html");
        browser.tabs.create({ url, active: true }).catch((error) => {
          console.error("Failed to open hub page:", error);
        });
      };

      const cycleLayoutMode = () => {
        if (!state.settings) return;
        const order: LayoutMode[] = ["tree", "mindmap"];
        const current = state.settings.layout.mode ?? "tree";
        const next = order[(order.indexOf(current) + 1) % order.length] ?? "tree";
        const nextSettings = {
          ...state.settings,
          layout: { ...state.settings.layout, mode: next },
        };
        state.setSettings(nextSettings);
        void saveSettings(nextSettings);
      };

      const toggleConnections = () => {
        if (!state.settings) return;
        const nextSettings = {
          ...state.settings,
          showConnections: !state.settings.showConnections,
        };
        state.setSettings(nextSettings);
        void saveSettings(nextSettings);
      };

      if (metaKey && code === "Slash") {
        event.preventDefault();
        state.setTooltipsOpen(!state.ui.tooltipsOpen);
        return;
      }

      if (isEditable) return;

      if (metaKey && code === "KeyZ") {
        event.preventDefault();
        const canRedo = state.commandState?.canRedo ?? false;
        const canUndo = state.commandState?.canUndo ?? false;
        if (event.shiftKey) {
          if (!canRedo) return;
        } else if (!canUndo) {
          return;
        }
        try {
          const commandState = event.shiftKey ? await redo() : await undo();
          state.setCommandState(commandState);
        } catch (error) {
          console.error("Failed to update command state:", error);
        }
        return;
      }

      if (!isMac && metaKey && code === "KeyY") {
        event.preventDefault();
        const canRedo = state.commandState?.canRedo ?? false;
        if (!canRedo) return;
        try {
          const commandState = await redo();
          state.setCommandState(commandState);
        } catch (error) {
          console.error("Failed to update command state:", error);
        }
        return;
      }

      if (metaKey && (code === "KeyF" || code === "KeyK")) {
        event.preventDefault();
        openCommandPalette();
        return;
      }

      if (!metaKey && !event.altKey && !event.ctrlKey && code === "F2") {
        const ids = getTargetNodeIds();
        if (ids.length === 1) {
          event.preventDefault();
          const first = ids[0];
          if (first) state.openRenameDialog(first);
        }
        return;
      }

      if (!metaKey && !event.altKey && code === "Slash") {
        event.preventDefault();
        openCommandPalette();
        return;
      }

      if (metaKey && code === "Comma") {
        event.preventDefault();
        openHubPage();
        return;
      }

      if (metaKey && code === "KeyA") {
        event.preventDefault();
        if (event.shiftKey) {
          state.clearSelection();
        } else {
          selectAllNodes();
        }
        return;
      }

      if (!metaKey && !event.altKey && !event.ctrlKey && key === "Escape") {
        event.preventDefault();
        if (editorActive) {
          exitEditorMode().catch((error) => {
            console.error("Failed to exit editor:", error);
          });
          return;
        }
        state.closeAllPopups();
        state.closeContextMenu();
        state.clearSelection();
        state.clearSearch();
        state.setTooltipsOpen(false);
        return;
      }

      const overlayOpen =
        state.ui.pinnedOpen ||
        state.ui.treesOpen ||
        state.ui.tagFilterOpen ||
        Boolean(state.contextMenu);

      if (!metaKey && !event.altKey && !event.ctrlKey) {
        if (event.shiftKey && code === "KeyP") {
          event.preventDefault();
          if (!editorActive) togglePopup("pinnedOpen");
          return;
        }
        if (event.shiftKey && code === "KeyT") {
          event.preventDefault();
          togglePopup("treesOpen");
          return;
        }
        if (event.shiftKey && code === "KeyF") {
          event.preventDefault();
          if (!editorActive) togglePopup("tagFilterOpen");
          return;
        }
        if (event.shiftKey && code === "KeyL") {
          event.preventDefault();
          cycleLayoutMode();
          return;
        }
        if (event.shiftKey && code === "KeyC") {
          event.preventDefault();
          toggleConnections();
          return;
        }

        if (overlayOpen) return;

        if (code === "KeyP") {
          event.preventDefault();
          togglePinned(getTargetNodeIds());
          return;
        }

        if (key === "Enter") {
          if (editorActive) {
            event.preventDefault();
            return;
          }
          event.preventDefault();
          await openNodes(getTargetNodeIds());
          return;
        }

        if (key === "Delete" || key === "Backspace") {
          event.preventDefault();
          deleteNodes(getTargetNodeIds(), event.shiftKey);
          return;
        }

        if (!event.shiftKey && key === "ArrowUp") {
          event.preventDefault();
          await moveFocus("parent");
          return;
        }
        if (!event.shiftKey && key === "ArrowDown") {
          event.preventDefault();
          await moveFocus("child");
          return;
        }
        if (!event.shiftKey && key === "ArrowLeft") {
          event.preventDefault();
          await moveFocus("prev");
          return;
        }
        if (!event.shiftKey && key === "ArrowRight") {
          event.preventDefault();
          await moveFocus("next");
          return;
        }
      }

      if (metaKey && key === "Enter") {
        if (editorActive) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        openNodesInNewTabs(getTargetNodeIds());
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
