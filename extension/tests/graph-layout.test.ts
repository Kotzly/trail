import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { NodeId, Url, Title, Timestamp } from "../src/shared/types/ids.js";
import type { NavigationTreeJSON } from "../src/shared/types/tree.js";
import type { NavigationNodeJSON } from "../src/shared/types/node.js";
import { treeToNodes, treeToEdges } from "../src/features/graph/transforms.js";
import { computeLayout } from "../src/features/graph/layout.js";
import type { Settings } from "../src/shared/types/settings.js";

// ── Test helpers ────────────────────────────────────────────────────

function makeNode(
  id: number,
  children: NavigationNodeJSON[] = [],
): NavigationNodeJSON {
  return {
    id: id as NodeId,
    timestamp: Date.now() as Timestamp,
    data: {
      url: `https://example.com/${id}` as Url,
      title: `Page ${id}` as Title,
      pinned: false,
      tags: [],
    },
    children,
  };
}

function makeTree(root: NavigationNodeJSON | null, nodeCount: number): NavigationTreeJSON {
  return {
    root,
    currentNodeId: root?.id ?? null,
    nodeCount,
  };
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  customTheme: {
    enabled: false,
    dots: [],
    harmony: "floating",
    lightness: 0.5,
    opacity: 1,
    texture: 0,
    customColors: [],
    accentColor: null,
  },
  layout: {
    mode: "tree",
    tree: { verticalGapScale: 1, horizontalGapScale: 1, hideRoot: false },
    mindmap: { verticalGapScale: 1, horizontalGapScale: 1 },
  },
  titleTruncation: "end",
  graphDensity: "comfortable",
  showFavicons: true,
  showUrls: true,
  showTagDots: false,
  showTabCounts: true,
  showAudioIndicators: true,
  showConnections: true,
  dimClosedNodes: false,
  confirmNewTree: true,
  shortcutsEnabled: true,
  adaptivePerformance: true,
  keepTabsOnSwitch: false,
};

const NO_COLLAPSED = new Set<NodeId>();

// ── Transform tests ────────────────────────────────────────────────

describe("treeToNodes", () => {
  it("returns empty array for null tree", () => {
    const nodes = treeToNodes(null, {
      currentNodeId: null,
      openNodeIds: new Set(),
      nodeTabCounts: {},
      collapsedNodeIds: NO_COLLAPSED,
    });
    assert.equal(nodes.length, 0);
  });

  it("returns single node for single-node tree", () => {
    const root = makeNode(1);
    const tree = makeTree(root, 1);
    const nodes = treeToNodes(tree, {
      currentNodeId: 1 as NodeId,
      openNodeIds: new Set(),
      nodeTabCounts: {},
      collapsedNodeIds: NO_COLLAPSED,
    });
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0]!.data.isCurrent, true);
  });

  it("returns correct count for 3-level tree", () => {
    const root = makeNode(1, [
      makeNode(2, [makeNode(4), makeNode(5)]),
      makeNode(3),
    ]);
    const tree = makeTree(root, 5);
    const nodes = treeToNodes(tree, {
      currentNodeId: null,
      openNodeIds: new Set(),
      nodeTabCounts: {},
      collapsedNodeIds: NO_COLLAPSED,
    });
    assert.equal(nodes.length, 5);
  });

  it("excludes children of collapsed nodes", () => {
    const root = makeNode(1, [
      makeNode(2, [makeNode(4), makeNode(5)]),
      makeNode(3),
    ]);
    const tree = makeTree(root, 5);
    const collapsed = new Set([2 as NodeId]);
    const nodes = treeToNodes(tree, {
      currentNodeId: null,
      openNodeIds: new Set(),
      nodeTabCounts: {},
      collapsedNodeIds: collapsed,
    });
    // root(1) + collapsed-node(2) + sibling(3) = 3 (4 and 5 hidden)
    assert.equal(nodes.length, 3);
    const node2 = nodes.find((n) => n.data.nodeId === (2 as NodeId));
    assert.equal(node2?.data.isCollapsed, true);
    assert.equal(node2?.data.childCount, 2);
  });
});

describe("treeToEdges", () => {
  it("returns empty array for null tree", () => {
    const edges = treeToEdges(null, NO_COLLAPSED);
    assert.equal(edges.length, 0);
  });

  it("returns correct edges for tree", () => {
    const root = makeNode(1, [makeNode(2), makeNode(3)]);
    const tree = makeTree(root, 3);
    const edges = treeToEdges(tree, NO_COLLAPSED);
    assert.equal(edges.length, 2);
    assert.equal(edges[0]!.source, "1");
    assert.equal(edges[0]!.target, "2");
    assert.equal(edges[1]!.source, "1");
    assert.equal(edges[1]!.target, "3");
  });

  it("excludes edges to collapsed subtrees", () => {
    const root = makeNode(1, [
      makeNode(2, [makeNode(4), makeNode(5)]),
      makeNode(3),
    ]);
    const tree = makeTree(root, 5);
    const collapsed = new Set([2 as NodeId]);
    const edges = treeToEdges(tree, collapsed);
    // root→2 and root→3 exist, but 2→4 and 2→5 do not
    assert.equal(edges.length, 2);
  });
});

// ── Layout tests ───────────────────────────────────────────────────

describe("computeLayout", () => {
  it("returns empty layout for null tree", async () => {
    const result = await computeLayout(null, DEFAULT_SETTINGS, NO_COLLAPSED, {
      currentNodeId: null,
      openNodeIds: new Set(),
      nodeTabCounts: {},
    });
    assert.equal(result.nodes.length, 0);
    assert.equal(result.edges.length, 0);
  });

  it("returns single node with finite position", async () => {
    const tree = makeTree(makeNode(1), 1);
    const result = await computeLayout(tree, DEFAULT_SETTINGS, NO_COLLAPSED, {
      currentNodeId: 1 as NodeId,
      openNodeIds: new Set(),
      nodeTabCounts: {},
    });
    assert.equal(result.nodes.length, 1);
    assert.ok(Number.isFinite(result.nodes[0]!.position.x));
    assert.ok(Number.isFinite(result.nodes[0]!.position.y));
  });

  it("tree mode: children below parent", async () => {
    const root = makeNode(1, [makeNode(2), makeNode(3)]);
    const tree = makeTree(root, 3);
    const settings = { ...DEFAULT_SETTINGS, layout: { ...DEFAULT_SETTINGS.layout, mode: "tree" as const } };
    const result = await computeLayout(tree, settings, NO_COLLAPSED, {
      currentNodeId: null,
      openNodeIds: new Set(),
      nodeTabCounts: {},
    });
    const rootNode = result.nodes.find((n) => n.data.nodeId === (1 as NodeId));
    const childNode = result.nodes.find((n) => n.data.nodeId === (2 as NodeId));
    assert.ok(rootNode && childNode);
    assert.ok(childNode.position.y > rootNode.position.y, "child should be below parent in tree mode");
  });

  it("mindmap mode: children spread horizontally", async () => {
    const root = makeNode(1, [makeNode(2), makeNode(3)]);
    const tree = makeTree(root, 3);
    const settings = { ...DEFAULT_SETTINGS, layout: { ...DEFAULT_SETTINGS.layout, mode: "mindmap" as const } };
    const result = await computeLayout(tree, settings, NO_COLLAPSED, {
      currentNodeId: null,
      openNodeIds: new Set(),
      nodeTabCounts: {},
    });
    const rootNode = result.nodes.find((n) => n.data.nodeId === (1 as NodeId));
    const childNode = result.nodes.find((n) => n.data.nodeId === (2 as NodeId));
    assert.ok(rootNode && childNode);
    assert.ok(childNode.position.x !== rootNode.position.x, "child should be horizontally offset in mindmap mode");
  });

  it("all positions are finite numbers", async () => {
    const root = makeNode(1, [
      makeNode(2, [makeNode(4), makeNode(5)]),
      makeNode(3),
    ]);
    const tree = makeTree(root, 5);
    const result = await computeLayout(tree, DEFAULT_SETTINGS, NO_COLLAPSED, {
      currentNodeId: null,
      openNodeIds: new Set(),
      nodeTabCounts: {},
    });
    for (const node of result.nodes) {
      assert.ok(Number.isFinite(node.position.x), `node ${node.id} x is not finite`);
      assert.ok(Number.isFinite(node.position.y), `node ${node.id} y is not finite`);
    }
  });

  it("collapsed node excludes children", async () => {
    const root = makeNode(1, [
      makeNode(2, [makeNode(4), makeNode(5)]),
      makeNode(3),
    ]);
    const tree = makeTree(root, 5);
    const collapsed = new Set([2 as NodeId]);
    const result = await computeLayout(tree, DEFAULT_SETTINGS, collapsed, {
      currentNodeId: null,
      openNodeIds: new Set(),
      nodeTabCounts: {},
    });
    assert.equal(result.nodes.length, 3); // 1, 2, 3 (not 4, 5)
  });
});
