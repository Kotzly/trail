import type { NodeId } from '../../../../shared/types/ids';
import type { GraphAPI, ViewState } from '../types';

// Active context menu (for cleanup)
let activeContextMenu: HTMLElement | null = null;

// Current tool: 'hand' (pan) or 'select' (selection box)
let currentTool: 'hand' | 'select' = 'hand';

// Selected nodes (for multi-select)
let selectedNodeIds = new Set<NodeId>();

// Graph API for external control (centering, etc.)
let graphAPI: GraphAPI | null = null;

// Preserve view state across re-renders
let savedViewState: ViewState | null = null;

// Store tabStates and onNavigate for use in node creation and context menu
let currentTabStates: Record<NodeId, { muted?: boolean; audible?: boolean }> = {};
let currentOnNavigate: ((node: any) => void) | null = null;
let currentNodeTabCounts: Record<NodeId, number> = {};

// Store selection menu setting for use in setupPanZoom
let selectionMenuInstantSetting = false;

export function getActiveContextMenu(): HTMLElement | null {
  return activeContextMenu;
}

export function setActiveContextMenu(menu: HTMLElement | null): void {
  activeContextMenu = menu;
}

export function getCurrentTool(): 'hand' | 'select' {
  return currentTool;
}

export function setCurrentTool(tool: 'hand' | 'select'): void {
  currentTool = tool;
}

export function getSelectedNodeIds(): Set<NodeId> {
  return selectedNodeIds;
}

export function setSelectedNodeIds(ids: Set<NodeId>): void {
  selectedNodeIds = ids;
}

export function getGraphAPI(): GraphAPI | null {
  return graphAPI;
}

export function setGraphAPI(api: GraphAPI | null): void {
  graphAPI = api;
}

export function getSavedViewState(): ViewState | null {
  return savedViewState;
}

export function setSavedViewState(state: ViewState | null): void {
  savedViewState = state;
}

export function getCurrentTabStates(): Record<NodeId, { muted?: boolean; audible?: boolean }> {
  return currentTabStates;
}

export function setCurrentTabStates(states: Record<NodeId, { muted?: boolean; audible?: boolean }>): void {
  currentTabStates = states;
}

export function getCurrentOnNavigate(): ((node: any) => void) | null {
  return currentOnNavigate;
}

export function setCurrentOnNavigate(onNavigate: ((node: any) => void) | null): void {
  currentOnNavigate = onNavigate;
}

export function getCurrentNodeTabCounts(): Record<NodeId, number> {
  return currentNodeTabCounts;
}

export function setCurrentNodeTabCounts(counts: Record<NodeId, number>): void {
  currentNodeTabCounts = counts;
}

export function getSelectionMenuInstantSetting(): boolean {
  return selectionMenuInstantSetting;
}

export function setSelectionMenuInstantSetting(setting: boolean): void {
  selectionMenuInstantSetting = setting;
}

