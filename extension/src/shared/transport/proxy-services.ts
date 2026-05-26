import type { ProxyServiceKey } from "@webext-core/proxy-service";
import type {
  BeginTempSelectionInput,
  CommandState,
  DeleteTreeResponse,
  EnsureTreePushedOutcome,
  NodeLayoutInput,
  RestorableTreeSnapshot,
  TempSelectionSessionId,
  TreeSwitchOrigin,
  TreeUpdatedInput,
  TreesSnapshot,
} from "@shared/rpc/contracts.js";
import type { TrailExportBundle } from "@shared/types/export.js";
import type { FlagKey, ResolvedFlags } from "@shared/types/flags.js";
import type { NodeId, TabId, Title, Url } from "@shared/types/ids.js";
import type { Settings } from "@shared/types/settings.js";
import type { Tab } from "@shared/platform/webext.js";
import type { CompactTreeJSON } from "@shared/types/compact-tree.js";
import type {
  ApplyConflictMergeInput,
  ApplyResult,
  CompressedConflictPreview,
  ConflictPreviewError,
} from "@shared/types/tree-diff.js";
import type { ImportShareResult } from "@features/sharing/share-api.js";

export interface TreeService {
  navigateTo(input: { nodeId: NodeId; url?: Url }): Promise<void>;
  previewNode(input: { nodeId: NodeId }): Promise<void>;
  setCurrentNode(input: { nodeId: NodeId }): Promise<void>;
  beginTempSelection(
    input: BeginTempSelectionInput,
  ): Promise<{ sessionId: TempSelectionSessionId }>;
  previewTempSelection(input: {
    sessionId: TempSelectionSessionId;
    nodeId: NodeId;
    tabId?: TabId;
  }): Promise<{ previewedTabId: TabId | null }>;
  acceptTempSelection(input: { sessionId: TempSelectionSessionId; nodeId?: NodeId }): Promise<void>;
  cancelTempSelection(input: {
    sessionId: TempSelectionSessionId;
    keepSession?: boolean;
  }): Promise<void>;
  endTempSelection(input: { sessionId: TempSelectionSessionId }): Promise<void>;
  getTreeState(): Promise<TreeUpdatedInput>;
  getTrees(): Promise<TreesSnapshot>;
  clearTree(): Promise<void>;
  resetTreeData(): Promise<void>;
  downloadTreeLocally(input: { treeId: string }): Promise<void>;
  unloadTreeToCloud(input: { treeId: string }): Promise<void>;
  createNewTree(input: { label: string; origin?: TreeSwitchOrigin }): Promise<void>;
  openTree(input: { treeId: string; origin?: TreeSwitchOrigin }): Promise<void>;
  ensureTreeLoaded(input: { treeId: string }): Promise<boolean>;
  ensureTreePushed(input: { treeId: string }): Promise<EnsureTreePushedOutcome>;
  renameTree(input: { treeId: string; label: string }): Promise<void>;
  deleteTree(input: { treeId: string }): Promise<DeleteTreeResponse>;
  restoreTree(input: { snapshot: RestorableTreeSnapshot }): Promise<void>;
  exportTree(input: { treeId?: string }): Promise<TrailExportBundle>;
  setNodeLayout(input: NodeLayoutInput): Promise<void>;
  setNodeLayoutBatch(input: { layouts: NodeLayoutInput[] }): Promise<void>;
  resetNodeLayouts(): Promise<void>;
  importTrail(input: { bundle: TrailExportBundle }): Promise<{ treeId: string }>;
  importSharedTrail(input: { code: string }): Promise<ImportShareResult>;
  reparentNode(input: { nodeId: NodeId; newParentId: NodeId }): Promise<void>;
  renameNode(input: { nodeId: NodeId; title: string }): Promise<void>;
  fetchConflictPreview(input: {
    treeId: string;
  }): Promise<
    { ok: true; value: CompressedConflictPreview } | { ok: false; error: ConflictPreviewError }
  >;
  getStoredTreeForConflict(input: { treeId: string }): Promise<{ compact: CompactTreeJSON | null }>;
  applyConflictMerge(input: ApplyConflictMergeInput): Promise<ApplyResult>;
  forkTreeFromConflict(input: {
    treeId: string;
  }): Promise<{ ok: true; forkedTreeId: string } | { ok: false; reason: string }>;
  getPendingConflicts(): Promise<{
    conflicts: Array<{
      treeId: string;
      serverUpdatedAt: string;
      serverDeviceId: string;
      label: string;
    }>;
  }>;
}

export interface CommandService {
  getCommandState(): Promise<CommandState>;
  undo(): Promise<CommandState>;
  redo(): Promise<CommandState>;
}

export interface SettingsService {
  getSettings(): Promise<Settings>;
  saveSettings(input: { settings: Settings }): Promise<void>;
}

export interface FlagsService {
  getFlags(): Promise<ResolvedFlags>;
  setFlag(input: { key: FlagKey; value: unknown }): Promise<ResolvedFlags>;
  resetFlags(): Promise<ResolvedFlags>;
}

export interface TabsService {
  getTabsForNode(input: { nodeId: NodeId }): Promise<Tab[]>;
}

export interface ActionService {
  openInNewTab(input: { nodeId: NodeId }): Promise<void>;
  toggleMute(input: { nodeId: NodeId; tabId: TabId }): Promise<void>;
  closeTab(input: { nodeId: NodeId; tabId: TabId }): Promise<void>;
  bulkCloseTabs(input: { nodeIds: NodeId[] }): Promise<void>;
  togglePin(input: { nodeId: NodeId }): Promise<void>;
  bulkPin(input: { nodeIds: NodeId[] }): Promise<void>;
  bulkUnpin(input: { nodeIds: NodeId[] }): Promise<void>;
  deleteNode(input: { nodeId: NodeId }): Promise<void>;
  deleteChildren(input: { nodeId: NodeId }): Promise<void>;
  deleteWithChildren(input: { nodeId: NodeId }): Promise<void>;
  bulkDelete(input: { nodeIds: NodeId[] }): Promise<void>;
  bulkDeleteNodes(input: { nodeIds: NodeId[] }): Promise<void>;
  bulkDeleteRecursive(input: { nodeIds: NodeId[] }): Promise<void>;
}

export const TREE_SERVICE_KEY = "trail/tree-service" as ProxyServiceKey<TreeService>;
export const COMMAND_SERVICE_KEY = "trail/command-service" as ProxyServiceKey<CommandService>;
export const SETTINGS_SERVICE_KEY = "trail/settings-service" as ProxyServiceKey<SettingsService>;
export const FLAGS_SERVICE_KEY = "trail/flags-service" as ProxyServiceKey<FlagsService>;
export const TABS_SERVICE_KEY = "trail/tabs-service" as ProxyServiceKey<TabsService>;
export const ACTION_SERVICE_KEY = "trail/action-service" as ProxyServiceKey<ActionService>;

export type TitleChangePayload = { url: Url; title: Title };
