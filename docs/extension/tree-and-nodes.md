# Extension: Tree and Nodes

**Scope:** `extension/` — navigation tree data model and storage  
**Purpose:** Represent browsing tree (root, nodes with url/title/tags/pin/layout); persist current and archived trees; sync with tabs and undo.

---

## File Map

| Role | Path |
|------|------|
| Tree types | `extension/src/shared/types/tree.ts` |
| Node types | `extension/src/shared/types/node.ts` |
| Ids (NodeId, Url, Tag, etc.) | `extension/src/shared/types/ids.ts` |
| Tree node (runtime) | `extension/src/background/state/tree-node.ts` |
| Nav tree state | `extension/src/background/state/nav-tree.ts` |
| Tree storage | `extension/src/background/services/tree-storage.ts` |
| Tree handlers | `extension/src/background/messaging/handlers/tree-handlers.ts` |

---

## Interfaces

### Ids (ids.ts)

- `NodeId`, `Url`, `Title`, `FaviconUrl`, `Tag`, `TabId`, `Timestamp` — branded strings or primitives.

### NodeData (node.ts)

```ts
type NodeData = {
  readonly url: Url;
  title: Title;
  favicon?: FaviconUrl;
  pinned: boolean;
  tags: Tag[];
  layout?: {
    offsetX: number;
    offsetY: number;
    radial?: { angleDelta: number; radiusDelta: number };
  };
};

type NodeDataPatch = Partial<Omit<NodeData, "url">>;
type NodeMetaPatch = Pick<NodeData, "title" | "favicon">;
```

- `updateNodeData(old, patch)`, `updateNodeMeta(old, patch)` — immutable updates.

### TreeNodeJSON (node.ts)

```ts
type TreeNodeJSON<T> = {
  id: NodeId;
  timestamp: Timestamp;
  data: T;
  children: TreeNodeJSON<T>[];
};

type NavigationNode = TreeNode<NodeData>;
type NavigationNodeJSON = TreeNodeJSON<NodeData>;
```

### Tree (tree.ts)

```ts
type TreeLabelSource = 'user' | 'auto' | 'system';

type TreeMeta = {
  id: string;
  label: string;
  labelSource: TreeLabelSource;
  labelUpdatedAt: number;
  createdAt: number;
};

type TreeSummary = TreeMeta & {
  nodeCount: number;
  savedAt: number;
  rootUrl?: Url;
  rootTitle?: Title;
  rootFavicon?: FaviconUrl;
};

type TreeRecord = TreeSummary & { tree: NavigationTreeJSON };

type NavigationTreeJSON = {
  root: NavigationNodeJSON | null;
  currentNodeId: NodeId | null;
  capacity: number;
  nodeCount: number;
};
```

---

## Design Patterns

1. **Immutable updates**  
   Tree and node updates produce new JSON; no in-place mutation. Undo/redo replays snapshots or commands.

2. **Current vs archived**  
   One “active” tree (current session); archived trees are stored (e.g. by treeId); OPEN_TREE switches active; NEW_TREE/CLEAR_TREE reset or create.

3. **Capacity / node count**  
   `NavigationTreeJSON.capacity` and `nodeCount` drive eviction or limits; tree storage may enforce max nodes or max trees.

4. **Layout per node**  
   `NodeData.layout` stores manual offsets (tree/mindmap) or radial deltas for custom positioning in graph.

5. **Tree handlers**  
   GET_TREE returns current tree + openNodeIds + tabStates + nodeTabCounts + reason; GET_TREES returns active meta + archived list; CLEAR_TREE, NEW_TREE, OPEN_TREE, RENAME_TREE, DELETE_ARCHIVED_TREE mutate state and optionally persist; TREE_UPDATED/TREES_UPDATED broadcast to UI.

---

## TreeNode (background/state/tree-node.ts)

- Runtime class or interface: holds `id`, `data`, `children`, and methods like `findNode(id)`, `walk()`, `toJSON()`. Used by nav-tree and layout.

---

## AI Agent Notes

- Add node field: extend NodeData and NodeDataPatch; update tree-node and any serialization; graph NodeRenderModel and layout if needed.
- Eviction: see shared/lib/eviction or tree-storage; when over capacity, remove nodes (e.g. by recency or policy).
- findNodesByQuery: implemented on tree instance (walk + match or MiniSearch); returns NodeId[] for search feature.
