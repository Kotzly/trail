import type { NodeId } from "../../../../shared/types/ids.js";
import type { GraphAPI, ViewState } from "../types.js";
import type { TabState } from "../../../../shared/types/tabs.js";

type Tool = "hand" | "select";


class graphState {
  // Active context menu (for cleanup)
  private activeContextMenu: HTMLElement | null = null;

  // Current tool: 'hand' (pan) or 'select' (selection box)
  private currentTool: Tool = "hand";

  // Selected nodes (for multi-select)
  private selectedNodeIds: Set<NodeId> = new Set<NodeId>();

  // Graph API for external control (centering, etc.)
  private graphAPI: GraphAPI | null = null;

  // Preserve view state across re-renders
  private savedViewState: ViewState | null = null;

  // Store tabStates for use in node creation and context menu
  private currentTabStates: Record<NodeId, TabState> = {};

  private currentNodeTabCounts: Record<NodeId, number> = {};

  // ---- getters / setters ----

  getActiveContextMenu(): HTMLElement | null {
    return this.activeContextMenu;
  }
  setActiveContextMenu(menu: HTMLElement | null): void {
    this.activeContextMenu = menu;
  }

  getCurrentTool(): Tool {
    return this.currentTool;
  }
  setCurrentTool(tool: Tool): void {
    this.currentTool = tool;
  }

  /** Returns the live Set reference (mutating it mutates store). */
  getSelectedNodeIds(): Set<NodeId> {
    return this.selectedNodeIds;
  }
  /** Replace the whole Set. */
  setSelectedNodeIds(ids: Set<NodeId>): void {
    this.selectedNodeIds = ids;
  }
  /** Convenience helpers (optional but handy) */
  clearSelection(): void {
    this.selectedNodeIds.clear();
  }
  selectOnly(ids: Iterable<NodeId>): void {
    this.selectedNodeIds = new Set(ids);
  }

  getGraphAPI(): GraphAPI | null {
    return this.graphAPI;
  }
  setGraphAPI(api: GraphAPI | null): void {
    this.graphAPI = api;
  }

  getSavedViewState(): ViewState | null {
    return this.savedViewState;
  }
  setSavedViewState(state: ViewState | null): void {
    this.savedViewState = state;
  }

  getCurrentTabStates(): Record<NodeId, TabState> {
    return this.currentTabStates;
  }
  setCurrentTabStates(states: Record<NodeId, TabState>): void {
    this.currentTabStates = states;
  }

  getCurrentNodeTabCounts(): Record<NodeId, number> {
    return this.currentNodeTabCounts;
  }
  setCurrentNodeTabCounts(counts: Record<NodeId, number>): void {
    this.currentNodeTabCounts = counts;
  }


  /** Optional: reset to initial state (keeps instance). */
  reset(): void {
    this.activeContextMenu = null;
    this.currentTool = "hand";
    this.selectedNodeIds = new Set<NodeId>();
    this.graphAPI = null;
    this.savedViewState = null;
    this.currentTabStates = {};
    this.currentNodeTabCounts = {};
  }
}

export const GraphState = new graphState();