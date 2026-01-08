import type { NodeId } from "../../../../shared/types/ids";
import type { GraphAPI, ViewState } from "../types";
import type { TabState } from "../../../../shared/types/tabs";

type Tool = "hand" | "select";
type OnNavigate = ((node: any) => void) | null;


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

  // Store tabStates and onNavigate for use in node creation and context menu
  private currentTabStates: Record<NodeId, TabState> = {};

  private currentOnNavigate: OnNavigate = null;

  private currentNodeTabCounts: Record<NodeId, number> = {};

  // Store selection menu setting for use in setupPanZoom
  private selectionMenuInstantSetting = false;

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

  getCurrentOnNavigate(): OnNavigate {
    return this.currentOnNavigate;
  }
  setCurrentOnNavigate(onNavigate: OnNavigate): void {
    this.currentOnNavigate = onNavigate;
  }

  getCurrentNodeTabCounts(): Record<NodeId, number> {
    return this.currentNodeTabCounts;
  }
  setCurrentNodeTabCounts(counts: Record<NodeId, number>): void {
    this.currentNodeTabCounts = counts;
  }

  getSelectionMenuInstantSetting(): boolean {
    return this.selectionMenuInstantSetting;
  }
  setSelectionMenuInstantSetting(setting: boolean): void {
    this.selectionMenuInstantSetting = setting;
  }

  /** Optional: reset to initial state (keeps instance). */
  reset(): void {
    this.activeContextMenu = null;
    this.currentTool = "hand";
    this.selectedNodeIds = new Set<NodeId>();
    this.graphAPI = null;
    this.savedViewState = null;
    this.currentTabStates = {};
    this.currentOnNavigate = null;
    this.currentNodeTabCounts = {};
    this.selectionMenuInstantSetting = false;
  }
}

export const GraphState = new graphState();