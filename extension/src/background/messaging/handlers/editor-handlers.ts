import {
  MSG,
  defineHandlers,
  ok,
  err,
  type EditorModeState,
} from '../../../shared/types/messages.js';
import { treeStorage } from '../../services/tree-storage.js';
import { notifyTreeUpdate } from '../notifications.js';
import { NavigationTreeMapper } from '../../../shared/lib/mapper.js';
import { CommandManager } from '../../../shared/lib/commands.js';
import type { Description, NodeId } from '../../../shared/types/ids.js';
import type { NavigationTree } from '../../state/nav-tree.js';
import type { NavigationNode, NodeData } from '../../../shared/types/node.js';
import { TreeNode } from '../../state/tree-node.js';
import { getCachedTree, setCachedTree } from '../../services/tree-cache.js';
import {
  editorSyncStart,
  editorSyncMarkDirty,
  editorSyncFlush,
  editorSyncStop,
} from '../../services/editor-sync.js';

/* ------------------------------------------------------------------ */
/*  Editor mode tracking (in-memory, background service worker)        */
/* ------------------------------------------------------------------ */

let editorState: EditorModeState = { active: false, treeId: null };

export function getEditorState(): EditorModeState {
  return editorState;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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
  // Register in tree's node map via public API (navigate will add to map).
  // Since addChild creates a new node with a fresh id, we need to register it.
  registerCloneInTree(tree, clone);

  for (const child of source.getChildren()) {
    cloneSubtree(child, clone, tree);
  }
  return clone;
}

/**
 * Register a cloned node in the tree's lookup structures.
 * This accesses the tree's internal nodeMap via the findNodeById check.
 * Since NavigationTree doesn't expose addNode directly, we use a workaround:
 * we rely on the tree being re-serialized and deserialized after duplication.
 */
function registerCloneInTree(_tree: NavigationTree, _node: NavigationNode): void {
  // The node is already attached to the tree structure via parent.addChild().
  // After duplication, we force a re-serialize → cache → notify cycle,
  // which causes the sidepanel to rebuild from JSON (all nodes get registered).
}

/**
 * Broadcast EDITOR_MODE_EXITED to all tabs so the web app (if open) can
 * update its UI reactively, even when the user exits from the sidepanel
 * rather than from the site.  Uses the content script's RELAY_TO_SITE
 * handler which is already present in every injected tab.
 */
async function broadcastEditorExitToSite(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    const payload = {
      source: 'trail-extension',
      type: 'EDITOR_MODE_EXITED',
      editorMode: false,
    };
    for (const tab of tabs) {
      if (tab.id === undefined) continue;
      chrome.tabs.sendMessage(tab.id, {
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
  // Try to load the tree: active tree → LRU cache → local archives
  let treeJSON: import('../../../shared/types/tree.js').NavigationTreeJSON | null = null;

  // 1. Check if it's the currently active tree
  const activeMeta = await treeStorage.getActiveMeta();
  const isActiveTree = activeMeta.id === treeId;
  if (isActiveTree) {
    const activeTree = await treeStorage.getOrCreateTree();
    treeJSON = NavigationTreeMapper.toJSON(activeTree);
  }

  // 2. Check LRU cache
  if (!treeJSON) {
    const cached = await getCachedTree(treeId);
    if (cached) {
      treeJSON = cached.tree;
    }
  }

  // 3. Fall back to local archives
  if (!treeJSON) {
    const archives = await treeStorage.getArchives();
    const record = archives.find((entry) => entry.id === treeId);
    if (record) {
      treeJSON = record.tree;
      // Populate LRU cache for next time
      await setCachedTree(treeId, record.tree, Date.now());
    }
  }

  if (!treeJSON) {
    return 'Tree not found in local archives or cache';
  }

  // Load the tree for editing
  const tree = NavigationTreeMapper.fromJSON(treeJSON);

  // Save snapshot before entering editor mode
  const currentTree = await treeStorage.getOrCreateTree();
  snapshot(currentTree, 'Enter editor mode');

  CommandManager.clearHistory();
  editorState = { active: true, treeId };

  // Start tracking sync for this editor session
  editorSyncStart(treeId);

  // Tell tree-storage to guard against persisting editor tree to TREE_KEY
  // when we are editing a non-active (archived) tree.
  if (!isActiveTree) {
    treeStorage.setEditingNonActiveTree(true);
  }

  // Cache the editor tree so all handlers operate on it in memory.
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

export async function exitEditorMode(): Promise<EditorModeState> {
  if (!editorState.active) {
    return editorState;
  }

  // Flush any pending cloud sync before exiting
  await editorSyncFlush();
  editorSyncStop();

  const wasEditingNonActive = treeStorage.isEditingNonActiveTree;

  // Restore the real active tree from chrome.storage if we were editing
  // a non-active (archived) tree so the UI sees the correct tree.
  if (wasEditingNonActive) {
    await treeStorage.restoreActiveTreeFromStorage();
    treeStorage.setEditingNonActiveTree(false);
  }

  editorState = { active: false, treeId: null };
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

  // Notify any open site tabs so they can update their UI
  void broadcastEditorExitToSite();

  return editorState;
}

export const editorHandlers = defineHandlers({
  async [MSG.ENTER_EDITOR_MODE](message) {
    const result = await enterEditorMode(message.treeId);
    return typeof result === 'string' ? err(result) : ok(result);
  },

  async [MSG.EXIT_EDITOR_MODE]() {
    return ok(await exitEditorMode());
  },

  async [MSG.REPARENT_NODE](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err('Node not found');

    const newParent = tree.findNodeById(message.newParentId);
    if (!newParent) return err('New parent not found');

    if (node.isRoot()) return err('Cannot reparent root node');

    // Prevent cycles: new parent cannot be a descendant of the dragged node
    if (isDescendant(tree, message.nodeId, message.newParentId)) {
      return err('Cannot reparent to a descendant');
    }

    // Already the correct parent
    if (node.getParent()?.id === message.newParentId) return ok();

    snapshot(tree, 'Reparent node');

    // attachChild handles detach from old parent + attach to new parent
    newParent.attachChild(node);

    // Reset layout offsets for the reparented subtree — offsets are relative
    // to the old parent's position and meaningless under the new parent.
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

    // Mark dirty for debounced sync
    if (editorState.active) editorSyncMarkDirty();

    await notifyTreeUpdate(tree, 'reparent', {
      focusNodeId: message.nodeId,
      mode: 'soft',
    });

    return ok();
  },

  async [MSG.DUPLICATE_SUBTREE](message) {
    const tree = await treeStorage.getOrCreateTree();
    const node = tree.findNodeById(message.nodeId);
    if (!node) return err('Node not found');

    const targetParent = tree.findNodeById(message.targetParentId);
    if (!targetParent) return err('Target parent not found');

    // Prevent duplicating to the same parent (creates identical siblings)
    const currentParent = node.getParent();
    if (currentParent?.id === message.targetParentId) {
      return err('Cannot duplicate to the same parent');
    }

    // Prevent duplicating into own subtree (would create a cycle)
    if (message.nodeId === message.targetParentId || isDescendant(tree, message.nodeId, message.targetParentId)) {
      return err('Cannot duplicate into own subtree');
    }

    snapshot(tree, 'Duplicate subtree');

    cloneSubtree(node, targetParent, tree);

    // Force re-serialize to register all new nodes
    const json = NavigationTreeMapper.toJSON(tree);
    const refreshed = NavigationTreeMapper.fromJSON(json);
    treeStorage.cacheTree(refreshed);

    // Mark dirty for debounced sync
    if (editorState.active) editorSyncMarkDirty();

    await notifyTreeUpdate(refreshed, 'duplicate', {
      focusNodeId: message.targetParentId,
      mode: 'soft',
    });

    return ok();
  },

  async [MSG.EDITOR_SYNC_RETRY]() {
    const { editorSyncRetry } = await import('../../services/editor-sync.js');
    editorSyncRetry();
    return ok();
  },
});
