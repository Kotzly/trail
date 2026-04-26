import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import type { NodeId, Url, Title, Timestamp } from "../src/shared/types/ids.js";
import type { NavigationNodeJSON } from "../src/shared/types/node.js";
import type { NavigationTreeJSON } from "../src/shared/types/tree.js";
import { computeChainFoldInfo } from "../src/features/graph/fold-chains.js";
import { treeToEdges, treeToNodes } from "../src/features/graph/transforms.js";

// ── Helpers ────────────────────────────────────────────────────────

function makeNode(
  url: string,
  children: NavigationNodeJSON[] = [],
  pinned = false,
): NavigationNodeJSON {
  return {
    id: randomUUID() as NodeId,
    timestamp: 0 as Timestamp,
    data: {
      url: url as Url,
      title: url as Title,
      pinned,
      tags: [],
    },
    children,
  };
}

function tree(root: NavigationNodeJSON | null): NavigationTreeJSON {
  return { root, currentNodeId: root?.id ?? null, nodeCount: 0 };
}

const isTranslate = (url: string) => url.startsWith("https://translate.yandex.ru/");
const matchesNothing = () => false;

// ── Tests ──────────────────────────────────────────────────────────

describe("computeChainFoldInfo", () => {
  it("returns empty info for null tree", () => {
    const info = computeChainFoldInfo(null, isTranslate);
    assert.equal(info.hiddenIds.size, 0);
    assert.equal(info.tipFoldCounts.size, 0);
    assert.equal(info.headToTip.size, 0);
  });

  it("leaves non-matching tree untouched", () => {
    const root = makeNode("https://google.com/", [
      makeNode("https://example.com/a"),
      makeNode("https://example.com/b"),
    ]);
    const info = computeChainFoldInfo(tree(root), isTranslate);
    assert.equal(info.hiddenIds.size, 0);
    assert.equal(info.tipFoldCounts.size, 0);
  });

  it("does not fold single-node chain", () => {
    const root = makeNode("https://google.com/", [
      makeNode("https://translate.yandex.ru/?text=foo"),
    ]);
    const info = computeChainFoldInfo(tree(root), isTranslate);
    // One matching node with no matching child — nothing to fold.
    assert.equal(info.hiddenIds.size, 0);
    assert.equal(info.tipFoldCounts.size, 0);
  });

  it("folds a linear chain keeping only the tip", () => {
    // google → yandex1 → yandex2 → yandex3 (all yandex are linear)
    const yandex3 = makeNode("https://translate.yandex.ru/?text=three");
    const yandex2 = makeNode("https://translate.yandex.ru/?text=two", [yandex3]);
    const yandex1 = makeNode("https://translate.yandex.ru/?text=one", [yandex2]);
    const root = makeNode("https://google.com/", [yandex1]);

    const info = computeChainFoldInfo(tree(root), isTranslate);

    // yandex1 and yandex2 hidden; yandex3 is tip.
    assert.equal(info.hiddenIds.size, 2);
    assert.ok(info.hiddenIds.has(yandex1.id));
    assert.ok(info.hiddenIds.has(yandex2.id));
    assert.ok(!info.hiddenIds.has(yandex3.id));

    assert.equal(info.tipFoldCounts.get(yandex3.id), 2);
    assert.equal(info.headToTip.get(yandex1.id)?.id, yandex3.id);
  });

  it("breaks chain at branching — does not fold", () => {
    const y1 = makeNode("https://translate.yandex.ru/?text=one", [
      makeNode("https://translate.yandex.ru/?text=a"),
      makeNode("https://translate.yandex.ru/?text=b"),
    ]);
    const root = makeNode("https://google.com/", [y1]);
    const info = computeChainFoldInfo(tree(root), isTranslate);

    // y1 has two matching kids — branching. Each kid is a single-node
    // chain (no matching descendants), so nothing is folded.
    assert.equal(info.hiddenIds.size, 0);
    assert.equal(info.tipFoldCounts.size, 0);
  });

  it("breaks chain when a child stops matching", () => {
    // y1 → y2 → google.com
    // Chain is y1 → y2 (length 2). y2 is tip (its child doesn't match).
    const google = makeNode("https://google.com/?q=x");
    const y2 = makeNode("https://translate.yandex.ru/?text=two", [google]);
    const y1 = makeNode("https://translate.yandex.ru/?text=one", [y2]);
    const root = makeNode("https://start.com/", [y1]);

    const info = computeChainFoldInfo(tree(root), isTranslate);

    assert.equal(info.hiddenIds.size, 1);
    assert.ok(info.hiddenIds.has(y1.id));
    assert.equal(info.tipFoldCounts.get(y2.id), 1);
    assert.equal(info.headToTip.get(y1.id)?.id, y2.id);
  });

  it("pinned chain member blocks folding", () => {
    const y3 = makeNode("https://translate.yandex.ru/?text=three");
    const y2 = makeNode("https://translate.yandex.ru/?text=two", [y3], /*pinned*/ true);
    const y1 = makeNode("https://translate.yandex.ru/?text=one", [y2]);
    const root = makeNode("https://google.com/", [y1]);

    const info = computeChainFoldInfo(tree(root), isTranslate);

    // Pin overrides the default auto-fold behaviour.
    assert.equal(info.hiddenIds.size, 0);
    assert.equal(info.tipFoldCounts.size, 0);
  });

  it("manual unfold of a tip disables the fold for that chain", () => {
    const tip = makeNode("https://translate.yandex.ru/?text=tip");
    const y1 = makeNode("https://translate.yandex.ru/?text=one", [tip]);
    const root = makeNode("https://google.com/", [y1]);

    const folded = computeChainFoldInfo(tree(root), isTranslate);
    assert.equal(folded.hiddenIds.size, 1);
    assert.equal(folded.unfoldedTipIds.size, 0);

    const unfolded = computeChainFoldInfo(
      tree(root),
      isTranslate,
      new Set<NodeId>([tip.id]),
    );
    assert.equal(unfolded.hiddenIds.size, 0);
    assert.equal(unfolded.tipFoldCounts.size, 0);
    // Tip is exposed so UI can show a refold affordance.
    assert.equal(unfolded.unfoldedTipIds.size, 1);
    assert.ok(unfolded.unfoldedTipIds.has(tip.id));
  });

  it("non-foldable chain (pinned/too-short) does not populate unfoldedTipIds", () => {
    const tip = makeNode("https://translate.yandex.ru/?text=tip");
    const root = makeNode("https://google.com/", [tip]);
    // Single-node chain — nothing to fold. Even if user "unfolded" the tip,
    // nothing gets marked because there's no chain to refold.
    const info = computeChainFoldInfo(tree(root), isTranslate, new Set([tip.id]));
    assert.equal(info.unfoldedTipIds.size, 0);
  });

  it("handles root as chain head", () => {
    const tip = makeNode("https://translate.yandex.ru/?text=tip");
    const root = makeNode("https://translate.yandex.ru/?text=root", [tip]);

    const info = computeChainFoldInfo(tree(root), isTranslate);

    assert.equal(info.hiddenIds.size, 1);
    assert.ok(info.hiddenIds.has(root.id));
    assert.equal(info.tipFoldCounts.get(tip.id), 1);
    assert.equal(info.headToTip.get(root.id)?.id, tip.id);
  });

  it("handles two independent sibling chains", () => {
    const a2 = makeNode("https://translate.yandex.ru/?text=a2");
    const a1 = makeNode("https://translate.yandex.ru/?text=a1", [a2]);
    const b2 = makeNode("https://translate.yandex.ru/?text=b2");
    const b1 = makeNode("https://translate.yandex.ru/?text=b1", [b2]);
    const root = makeNode("https://portal.com/", [a1, b1]);

    const info = computeChainFoldInfo(tree(root), isTranslate);

    assert.equal(info.hiddenIds.size, 2);
    assert.ok(info.hiddenIds.has(a1.id));
    assert.ok(info.hiddenIds.has(b1.id));
    assert.equal(info.tipFoldCounts.get(a2.id), 1);
    assert.equal(info.tipFoldCounts.get(b2.id), 1);
    assert.equal(info.headToTip.get(a1.id)?.id, a2.id);
    assert.equal(info.headToTip.get(b1.id)?.id, b2.id);
  });

  it("passes through when matcher matches nothing", () => {
    const root = makeNode("https://translate.yandex.ru/?text=a", [
      makeNode("https://translate.yandex.ru/?text=b"),
    ]);
    const info = computeChainFoldInfo(tree(root), matchesNothing);
    assert.equal(info.hiddenIds.size, 0);
    assert.equal(info.tipFoldCounts.size, 0);
  });
});

// ── Integration: fold info → treeToEdges / treeToNodes ─────────────

const NO_COLLAPSED = new Set<NodeId>();

describe("fold integration with treeToEdges / treeToNodes", () => {
  it("rewires parent→head to parent→tip AND emits tip's outgoing edges", () => {
    // A → B(head) → C(tip) → D, E   — D and E are non-matching siblings
    // of the chain. Bug would drop C→D and C→E.
    const d = makeNode("https://news.com/story");
    const e = makeNode("https://blog.com/post");
    const c = makeNode("https://translate.yandex.ru/?text=two", [d, e]);
    const b = makeNode("https://translate.yandex.ru/?text=one", [c]);
    const a = makeNode("https://google.com/", [b]);

    const info = computeChainFoldInfo(tree(a), isTranslate);
    const edges = treeToEdges(tree(a), NO_COLLAPSED, info);

    const edgePairs = edges.map((ed) => `${ed.source}->${ed.target}`);
    assert.ok(edgePairs.includes(`${a.id}->${c.id}`), "A→C (rewired tip)");
    assert.ok(edgePairs.includes(`${c.id}->${d.id}`), "C→D (tip's subtree)");
    assert.ok(edgePairs.includes(`${c.id}->${e.id}`), "C→E (tip's subtree)");
    assert.ok(!edgePairs.includes(`${a.id}->${b.id}`), "no A→B (head hidden)");
    assert.ok(!edgePairs.includes(`${b.id}->${c.id}`), "no B→C (head hidden)");
    assert.equal(edges.length, 3);
  });

  it("handles two sibling chains side by side", () => {
    // root → a1(head) → a2(tip) → aFollow
    //      → b1(head) → b2(tip)
    const aFollow = makeNode("https://news.com/");
    const a2 = makeNode("https://translate.yandex.ru/?text=a2", [aFollow]);
    const a1 = makeNode("https://translate.yandex.ru/?text=a1", [a2]);
    const b2 = makeNode("https://translate.yandex.ru/?text=b2");
    const b1 = makeNode("https://translate.yandex.ru/?text=b1", [b2]);
    const root = makeNode("https://portal.com/", [a1, b1]);

    const info = computeChainFoldInfo(tree(root), isTranslate);
    const edges = treeToEdges(tree(root), NO_COLLAPSED, info);
    const pairs = edges.map((ed) => `${ed.source}->${ed.target}`);

    assert.ok(pairs.includes(`${root.id}->${a2.id}`));
    assert.ok(pairs.includes(`${a2.id}->${aFollow.id}`));
    assert.ok(pairs.includes(`${root.id}->${b2.id}`));
    assert.equal(edges.length, 3);
  });

  it("treeToNodes skips hidden and stamps foldedAncestorCount on tip", () => {
    const tip = makeNode("https://translate.yandex.ru/?text=tip");
    const head = makeNode("https://translate.yandex.ru/?text=one", [tip]);
    const root = makeNode("https://google.com/", [head]);

    const info = computeChainFoldInfo(tree(root), isTranslate);
    const nodes = treeToNodes(
      tree(root),
      {
        currentNodeId: null,
        openNodeIds: new Set(),
        nodeTabCounts: {},
        collapsedNodeIds: NO_COLLAPSED,
      },
      undefined,
      info,
    );
    const ids = nodes.map((n) => n.data.nodeId);
    assert.ok(ids.includes(root.id));
    assert.ok(ids.includes(tip.id));
    assert.ok(!ids.includes(head.id));

    const tipNode = nodes.find((n) => n.data.nodeId === tip.id)!;
    assert.equal(tipNode.data.foldedAncestorCount, 1);
  });
});
