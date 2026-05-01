import type { NavigationNode, NavigationNodeJSON } from "../types/node.js";
import { TreeNode } from "@background/state/tree-node.js";
import { type NavigationTreeJSON } from "../types/tree.js";
import { NavigationTree } from "@background/state/nav-tree.js";
import { normalizeNodeData } from "../schemas/node.js";
import { buildNewTabRootData, isNewTabUrl } from "./root.js";
import { asNodeId, now, type NodeId, type Timestamp } from "../types/ids.js";
import { uuidv7 } from "./uuid.js";
import { createLogger } from "./logger.js";

const log = createLogger("tree-mapper");

export class TreeNodeMapper {
  static fromJSON(json: NavigationNodeJSON, parent?: NavigationNode): NavigationNode {
    const data = normalizeNodeData(json);
    const node = new TreeNode(data, parent, json.id);

    node.appendChildren((json.children ?? []).map((child) => TreeNodeMapper.fromJSON(child, node)));
    return node;
  }

  static toJSON(node: NavigationNode): NavigationNodeJSON {
    return {
      id: node.id,
      timestamp: node.timestamp,

      data: node.data,

      children: node.getChildren().map(TreeNodeMapper.toJSON),
    };
  }
}

/**
 * Wrap a non-NTP root under a synthesised NTP root. Idempotent: if the
 * incoming root is already an NTP, returns it unchanged. Called from
 * `fromJSON` so every deserialisation path — persisted-storage load,
 * import-bundle, sync-pull payload, undo restore, tree duplicate —
 * auto-repairs legacy or untrusted trees to match the root invariant
 * defined in `shared/lib/root.ts`.
 *
 * ID preservation: the original root keeps its NodeId (so pinned
 * state, saved layout positions, and any external reference to the
 * node — including `currentNodeId` — remain valid). The synthesised
 * wrapper gets a fresh uuidv7. Subtrees are reparented en masse.
 */
function ensureNtpRoot(rootJson: NavigationNodeJSON): NavigationNodeJSON {
  if (isNewTabUrl(rootJson.data.url)) return rootJson;

  log.info("wrapping non-NTP root under synthetic New Tab root", {
    originalUrl: rootJson.data.url,
    originalTitle: rootJson.data.title,
    originalId: rootJson.id,
  });

  return {
    id: asNodeId(uuidv7()),
    timestamp: now() as Timestamp,
    data: buildNewTabRootData(),
    children: [rootJson],
  };
}

export class NavigationTreeMapper {
  static toJSON(tree: NavigationTree): NavigationTreeJSON {
    const root = tree.getRoot();
    const current = tree.getCurrent();
    const nodeCount = tree.size();

    return {
      root: root ? TreeNodeMapper.toJSON(root) : null,
      currentNodeId: current?.id ?? null,
      nodeCount: nodeCount,
    };
  }

  static fromJSON(json: NavigationTreeJSON): NavigationTree {
    if (!json.root) {
      return new NavigationTree();
    }

    const rootJson = ensureNtpRoot(json.root);
    const root = TreeNodeMapper.fromJSON(rootJson);
    const tree = new NavigationTree(root);

    // `currentNodeId` references a persisted NodeId that still exists
    // in the tree whether or not we wrapped the root (the pre-existing
    // root kept its id; new wrapper root got a fresh one the persisted
    // state can't name). So the lookup logic is identical for wrapped
    // and unwrapped trees.
    //
    // `currentNodeId === null` is a VALID, intentional state: the user
    // is viewing an untrackable surface (Settings, chrome://, our own
    // sidepanel host, etc.) and the sidepanel should show no node as
    // "current". Do NOT auto-fall back to root in that case — that
    // bug masqueraded as "current jumps to New Tab when I open
    // Settings", because every deserialise round-trip kept lifting
    // null back to the root id.
    const persistedCurrent: NodeId | null = json.currentNodeId;
    if (persistedCurrent) {
      const ok = tree.setCurrentById(persistedCurrent);
      if (!ok) {
        // Persisted current references a node that was removed in a
        // prior session (e.g., merged away by deleteNode cleanup
        // before save). Fall back to root so the tree isn't headless.
        log.warn("persisted currentNodeId not found — falling back to root", {
          currentNodeId: persistedCurrent,
        });
        if (tree.getRoot()) {
          tree.setCurrent(tree.getRoot()!);
        }
      }
    }

    return tree;
  }
}
