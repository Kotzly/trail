import { useCallback } from "react";
import { toast } from "sonner";
import { i18n } from "#i18n";
import type { NodeId } from "@shared/types/ids.js";
import { captureEvent } from "@shared/lib/observability.js";
import { undo } from "../../api/commands.js";
import { deleteTree, restoreTree } from "../../api/tree.js";
import {
  bulkDeleteNodes,
  bulkDeleteRecursive,
  deleteNode,
  deleteWithChildren,
} from "../../api/actions.js";
import {
  countDeletedForIntent,
  resolveDeleteTarget,
  type DeleteIntent,
  type DeleteSource,
} from "../shared/delete-targets.js";
import { useStore } from "../state/store.js";
import { showOperationError } from "../shared/show-operation-error.js";
import { countOpenTabsForDelete, getIncludedRootId } from "../shared/delete-tree.js";

const TOAST_DURATION_MS = 8000;

type RequestOpts = { source: DeleteSource };

function describeNodeToast(args: {
  direct: number;
  hidden: number;
  recursive: boolean;
  promotedFromCollapsed: boolean;
  tabCount: number;
}): string {
  const { direct, hidden, recursive, promotedFromCollapsed, tabCount } = args;
  let core: string;
  if (promotedFromCollapsed && hidden > 0) {
    core = i18n.t("sidepanel.deleteToasts.subtreeWithHidden", [String(direct), String(hidden)]);
  } else if (recursive && hidden > 0) {
    core =
      direct === 1
        ? i18n.t("sidepanel.deleteToasts.subtreeOne", ["1", String(hidden)])
        : i18n.t("sidepanel.deleteToasts.subtreeMany", [String(direct), String(hidden)]);
  } else {
    core =
      direct === 1
        ? i18n.t("sidepanel.deleteToasts.nodeOne")
        : i18n.t("sidepanel.deleteToasts.nodeMany", [String(direct)]);
  }
  if (tabCount > 0) {
    core += i18n.t("sidepanel.deleteToasts.tabsClosedSuffix", [
      String(tabCount),
      tabCount === 1 ? "" : "s",
    ]);
  }
  return core;
}

/**
 * Core delete dispatcher. Pure function — reads `useStore.getState()`,
 * does the right RPC, shows the right sonner toast with Undo.
 *
 * Extracted from `useDeleteFlow` so non-component call sites (the
 * tinykeys bindings inside `useShortcuts`) can use the same flow
 * without going through React hooks. Component code should prefer
 * `useDeleteFlow().request` for clarity.
 */
export async function requestDelete(intent: DeleteIntent, opts?: RequestOpts): Promise<void> {
  const source: DeleteSource = opts?.source ?? "context";
  const state = useStore.getState();
  const { tree, graph, nodeTabCounts, trees } = state;

  if (intent.kind === "node" && intent.nodeIds.length === 0) return;

  // Multi-node intent containing the active root → escalate to tree
  // delete (deleting the root via node-RPC would leave a stub of an
  // empty tree, which P0c flow specifically avoids).
  if (intent.kind === "node") {
    const rootInSelection = getIncludedRootId(tree, intent.nodeIds);
    if (rootInSelection && trees.active?.id) {
      return requestDelete({ kind: "tree", treeId: trees.active.id }, opts);
    }
  }

  if (intent.kind === "tree") {
    try {
      const tabCount =
        trees.active?.id === intent.treeId
          ? Object.values(nodeTabCounts).reduce((sum, n) => sum + n, 0)
          : 0;
      const result = await deleteTree(intent.treeId);
      const label =
        result.snapshot.meta.label || i18n.t("sidepanel.deleteTreeConfirm.fallbackLabel");
      let message = i18n.t("sidepanel.deleteToasts.tree", [label]);
      if (tabCount > 0) {
        message += i18n.t("sidepanel.deleteToasts.tabsClosedSuffix", [
          String(tabCount),
          tabCount === 1 ? "" : "s",
        ]);
      }
      captureEvent("delete_executed", {
        kind: "tree",
        source,
        wasActive: result.snapshot.wasActive,
      });
      state.clearSelection();
      toast(message, {
        duration: TOAST_DURATION_MS,
        action: {
          label: i18n.t("sidepanel.deleteToasts.undo"),
          onClick: () => {
            void (async () => {
              try {
                await restoreTree(result.snapshot);
                captureEvent("delete_undone", { kind: "tree", source });
              } catch (err) {
                showOperationError(
                  i18n.t("sidepanel.deleteToasts.restoreFailed", [
                    err instanceof Error ? err.message : String(err),
                  ]),
                  err,
                );
              }
            })();
          },
        },
      });
    } catch (err) {
      showOperationError(i18n.t("sidepanel.deleteToasts.deleteFailed"), err);
    }
    return;
  }

  // intent.kind === "node"
  const resolved = resolveDeleteTarget(intent, graph.collapsedNodeIds);
  if (resolved.kind !== "node") return;
  const counts = countDeletedForIntent(tree, resolved);
  const tabCount = countOpenTabsForDelete(
    tree,
    resolved.nodeIds,
    nodeTabCounts,
    resolved.recursive ? "subtree" : "self",
  );

  try {
    if (resolved.recursive && resolved.nodeIds.length === 1) {
      await deleteWithChildren(resolved.nodeIds[0]!);
    } else if (!resolved.recursive && resolved.nodeIds.length === 1) {
      await deleteNode(resolved.nodeIds[0]!);
    } else if (resolved.recursive) {
      await bulkDeleteRecursive(resolved.nodeIds as NodeId[]);
    } else {
      await bulkDeleteNodes(resolved.nodeIds as NodeId[]);
    }
    captureEvent("delete_executed", {
      kind: "node",
      source,
      recursive: resolved.recursive,
      promotedFromCollapsed: resolved.promotedFromCollapsed,
      directCount: counts.direct,
      hiddenCount: counts.hidden,
    });
    state.clearSelection();
    const message = describeNodeToast({
      direct: counts.direct,
      hidden: counts.hidden,
      recursive: resolved.recursive,
      promotedFromCollapsed: resolved.promotedFromCollapsed,
      tabCount,
    });
    toast(message, {
      duration: TOAST_DURATION_MS,
      action: {
        label: i18n.t("sidepanel.deleteToasts.undo"),
        onClick: () => {
          void (async () => {
            try {
              await undo();
              captureEvent("delete_undone", { kind: "node", source });
            } catch (err) {
              showOperationError(
                i18n.t("sidepanel.deleteToasts.restoreFailed", [
                  err instanceof Error ? err.message : String(err),
                ]),
                err,
              );
            }
          })();
        },
      },
    });
  } catch (err) {
    showOperationError(i18n.t("sidepanel.deleteToasts.deleteFailed"), err);
  }
}

export function useDeleteFlow(): {
  request: (intent: DeleteIntent, opts?: RequestOpts) => Promise<void>;
} {
  const request = useCallback(
    (intent: DeleteIntent, opts?: RequestOpts) => requestDelete(intent, opts),
    [],
  );
  return { request };
}
