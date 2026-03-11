import {
  RPC_METHOD,
  defineRpcHandlers,
  ok,
  err,
  type EditorModeState,
} from '../../../shared/rpc/contracts.js';
import { treeStorage } from '../../services/tree-storage.js';
import { notifyTreeUpdate } from '../notifications.js';
import { NavigationTreeMapper } from '@shared/lib/mapper.js';
import { CommandManager } from '@shared/lib/commands.js';
import type { Description, NodeId } from '@shared/types/ids.js';
import type { NavigationTree } from '../../state/nav-tree.js';
import type { NavigationNode, NodeData } from '@shared/types/node.js';
import { TreeNode } from '../../state/tree-node.js';
import { loadTree } from '../../services/tree-loader.js';
import {
  editorSyncStart,
  editorSyncMarkDirty,
  editorSyncFlush,
  editorSyncStop,
} from '../../services/editor-sync.js';
import { isAllowedSiteOrigin } from '@shared/config/site-origins.js';
import type { NavigationTreeJSON } from '@shared/types/tree.js';
import { browser } from '@shared/platform/webext.js';

/* ------------------------------------------------------------------ */
/*  Editor mode tracking (in-memory, background service worker)        */
/* ------------------------------------------------------------------ */

let editorState: EditorModeState = { active: false, treeId: null };

type EditorSessionSnapshot = {
  treeId: string;
  tree: NavigationTreeJSON;
};

let editorSessionSnapshot: EditorSessionSnapshot | null = null;

export function getEditorState(): EditorModeState {
  return editorState;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function snapshot(tree: NavigationTree, description: string): void {
  CommandManager.saveSnapshot(
    NavigationTreeMapper.toJSON(tree),
    description as Description,
  );
}

/**
 * Check if `candidateId` is a descendant of `ancestorId` in the tree.
 * Returns true if moving to `candidateId` would create a cycle.
 */
function isDescendant(
  tree: NavigationTree,
  ancestorId: NodeId,
  candidateId: NodeId,
): boolean {
  let node = tree.findNodeById(candidateId);
  while (node) {
    if (node.id === ancestorId) return true;
    node = node.getParent();
  }
  return false;
}

/**
 * Deep-clone a subtree, creating new TreeNode instances with fresh IDs.
 */
function cloneSubtree(
  source: NavigationNode,
  parent: NavigationNode,
  tree: NavigationTree,
): NavigationNode {
  const clone = parent.addChild({ ...source.data });
  registerCloneInTree(tree, clone);

  for (const child of source.getChildren()) {
    cloneSubtree(child, clone, tree);
  }
  return clone;
}

/**
 * Register a cloned node in the tree's lookup structures.
 * The node is already attached via parent.addChild().
 * After duplication, we force a re-serialize → cache → notify cycle.
 */
function registerCloneInTree(_tree: NavigationTree, _node: NavigationNode): void {
  // no-op: re-serialize handles registration
}

/**
 * Broadcast EDITOR_MODE_EXITED to allowed site tabs.
 */
async function broadcastEditorExitToSite(): Promise<void> {
  try {
    const tabs = await browser.tabs.query({});
    const payload = {
      source: 'trail-extension',
      type: 'EDITOR_MODE_EXITED',
      editorMode: false,
    };
    for (const tab of tabs) {
      if (tab.id === undefined || !tab.url) continue;

      let origin: string;
      try {
        origin = new URL(tab.url).origin;
      } catch {
        continue;
      }
      if (!isAllowedSiteOrigin(origin)) continue;

      browser.tabs.sendMessage(tab.id, {
        type: 'RELAY_TO_SITE',
        payload,
      }).catch(() => { /* tab has no content script — ignore */ });
    }
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/*  Exported logic (reusable from site-message-handlers)               */
/* ------------------------------------------------------------------ */

export async function enterEditorMode(treeId: string): Promise<EditorModeState | string> {
  // Use tree-loader: active tree → archive blob → cloud fetch
  const record = await loadTree(treeId);

  if (!record) {
    editorSessionSnapshot = null;
    return 'Tree not found. Try syncing first by opening the trees dropdown.';
  }

  const treeJSON = record.tree;

  const activeMeta = await treeStorage.getActiveMeta();
  const isActiveTree = activeMeta.id === treeId;

  const tree = NavigationTreeMapper.fromJSON(treeJSON);
  editorSessionSnapshot = {
    treeId,
    tree: NavigationTreeMapper.toJSON(tree),
  };

  const currentTree = await treeStorage.getOrCreateTree();
  snapshot(currentTree, 'Enter editor mode');

  CommandManager.clearHistory();
  editorState = { active: true, treeId };

  editorSyncStart(treeId);

  if (!isActiveTree) {
    treeStorage.setEditingNonActiveTree(true);
  }

  treeStorage.cacheTree(tree);

  if (isActiveTree) {
    await notifyTreeUpdate(tree, 'editor-enter');
  } else {
    await notifyTreeUpdate(tree, 'editor-enter', {
      fitToView: true,
      mode: 'force',
    });
  }

  return editorState;
}

export type EditorModeActionResult =
  | { ok: true }
  | { ok: false; error: string };

async function finalizeEditorExit(): Promise<EditorModeState> {
  const wasEditingNonActive = treeStorage.isEditingNonActiveTree;

  editorSyncStop();

  if (wasEditingNonActive) {
    await treeStorage.restoreActiveTreeFromStorage();
    treeStorage.setEditingNonActiveTree(false);
  }

  editorState = { active: false, treeId: null };
  editorSessionSnapshot = null;
  CommandManager.clearHistory();

  const tree = await treeStorage.getOrCreateTree();

  if (wasEditingNonActive) {
    await notifyTreeUpdate(tree, 'editor-exit', {
      fitToView: true,
      mode: 'force',
    });
  } else {
    await notifyTreeUpdate(tree, 'editor-exit');
  }

  void broadcastEditorExitToSite();

  return editorState;
}

export async function saveEditorMode(): Promise<EditorModeActionResult> {
  if (!editorState.active) {
    return { ok: true };
  }

  const result = await editorSyncFlush();
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  await finalizeEditorExit();
  return { ok: true };
}

export async function cancelEditorMode(): Promise<EditorModeActionResult> {
  if (!editorState.active) {
    return { ok: true };
  }

  if (!editorSessionSnapshot || editorSessionSnapshot.treeId !== editorState.treeId) {
    return {
      ok: false,
      error: 'Editor session snapshot is missing',
    };
  }

  try {
    const currentTree = await treeStorage.getOrCreateTree();
    const currentTreeJSON = NavigationTreeMapper.toJSON(currentTree);

    const snapshotTree = NavigationTreeMapper.fromJSON(editorSessionSnapshot.tree);
    treeStorage.cacheTree(snapshotTree);

    editorSyncMarkDirty();
    const result = await editorSyncFlush();
    if (!result.ok) {
      const restoredTree = NavigationTreeMapper.fromJSON(currentTreeJSON);
      treeStorage.cacheTree(restoredTree);
      return { ok: false, error: result.error };
    }

    await finalizeEditorExit();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: toErrorMessage(error, 'Failed to rollback editor session'),
    };
  }
}

export const editorHandlers = defineRpcHandlers({
  async [RPC_METHOD.ENTER_EDITOR_MODE](message) {
    const result = await enterEditorMode(message.treeId);
    return typeof result === 'string' ? err(result) : ok(result);
  },

  async [RPC_METHOD.EXIT_EDITOR_MODE]() {
    const result = await saveEditorMode();
    if (!result.ok) {
      return err(result.error);
    }
    return ok(editorState);
  },

  async [RPC_METHOD.REPARENT_NODE](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err('Node not found');

    const newParent = tree.findNodeById(message.newParentId);
    if (!newParent) return err('New parent not found');

    if (node.isRoot()) return err('Cannot reparent root node');

    if (isDescendant(tree, message.nodeId, message.newParentId)) {
      return err('Cannot reparent to a descendant');
    }

    if (node.getParent()?.id === message.newParentId) return ok();

    snapshot(tree, 'Reparent node');

    newParent.attachChild(node);

    const resetLayout = (n: TreeNode<NodeData>) => {
      if (n.data.layout) {
        const { layout: _, ...rest } = n.data;
        n.data = rest as NodeData;
      }
      for (const child of n.getChildren()) {
        resetLayout(child);
      }
    };
    resetLayout(node);

    treeStorage.cacheTree(tree);

    if (editorState.active) editorSyncMarkDirty();

    await notifyTreeUpdate(tree, 'reparent', {
      focusNodeId: message.nodeId,
      mode: 'soft',
    });

    return ok();
  },

  async [RPC_METHOD.DUPLICATE_SUBTREE](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err('Node not found');

    const targetParent = tree.findNodeById(message.targetParentId);
    if (!targetParent) return err('Target parent not found');

    const currentParent = node.getParent();
    if (currentParent?.id === message.targetParentId) {
      return err('Cannot duplicate to the same parent');
    }

    if (message.nodeId === message.targetParentId || isDescendant(tree, message.nodeId, message.targetParentId)) {
      return err('Cannot duplicate into own subtree');
    }

    snapshot(tree, 'Duplicate subtree');

    cloneSubtree(node, targetParent, tree);

    const json = NavigationTreeMapper.toJSON(tree);
    const refreshed = NavigationTreeMapper.fromJSON(json);
    treeStorage.cacheTree(refreshed);

    if (editorState.active) editorSyncMarkDirty();

    await notifyTreeUpdate(refreshed, 'duplicate', {
      focusNodeId: message.targetParentId,
      mode: 'soft',
    });

    return ok();
  },

  async [RPC_METHOD.EDITOR_SYNC_RETRY]() {
    const { editorSyncRetry } = await import('../../services/editor-sync.js');
    editorSyncRetry();
    return ok();
  },
});
