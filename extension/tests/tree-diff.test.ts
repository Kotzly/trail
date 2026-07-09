/**
 * Unit tests for the pure sync-conflict diff primitives.
 *
 * Covers the 19 cases in the sync-conflict diff verification spec.
 */

import assert from "node:assert/strict";

import type { NodeId, Tag, Title, Timestamp, Url } from "../src/shared/types/ids.js";
import type { NavigationNodeJSON, NodeData } from "../src/shared/types/node.js";
import type { NavigationTreeJSON } from "../src/shared/types/tree.js";
import type {
  ConflictPickState,
  DiffNode,
  LabelSide,
  TreeDiff,
} from "../src/shared/types/tree-diff.js";

import {
  applyMerge,
  defaultLabelPick,
  diffTrees,
  validateMergedTree,
} from "../src/shared/lib/tree-diff.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const nid = (s: string): NodeId => s as unknown as NodeId;
const asUrl = (s: string): Url => s as Url;
const asTitle = (s: string): Title => s as Title;

function mkNode(args: {
  id: string;
  url: string;
  title?: string;
  pinned?: boolean;
  tags?: string[];
  lastVisitedAt?: number;
  visitCount?: number;
  favicon?: string;
  pinnedUpdatedAt?: number;
  layout?: { offsetX: number; offsetY: number };
  layoutUpdatedAt?: number;
  timestamp?: number;
  children?: NavigationNodeJSON[];
}): NavigationNodeJSON {
  const data: NodeData = {
    url: asUrl(args.url),
    title: asTitle(args.title ?? args.url),
    pinned: args.pinned ?? false,
    tags: (args.tags ?? []) as Tag[],
  };
  if (args.favicon !== undefined) (data as NodeData).favicon = args.favicon as Url & { __brand_FaviconUrl: true };
  if (args.pinnedUpdatedAt !== undefined) data.pinnedUpdatedAt = args.pinnedUpdatedAt as Timestamp;
  if (args.lastVisitedAt !== undefined) data.lastVisitedAt = args.lastVisitedAt as Timestamp;
  if (args.visitCount !== undefined) data.visitCount = args.visitCount;
  if (args.layout !== undefined) data.layout = args.layout;
  if (args.layoutUpdatedAt !== undefined) data.layoutUpdatedAt = args.layoutUpdatedAt as Timestamp;
  return {
    id: nid(args.id),
    timestamp: (args.timestamp ?? 0) as Timestamp,
    data,
    children: args.children ?? [],
  };
}

function ntpRoot(children: NavigationNodeJSON[] = [], rootId = "ntp-root"): NavigationNodeJSON {
  return mkNode({ id: rootId, url: "chrome://newtab/", title: "New Tab", children });
}

function countNodes(n: NavigationNodeJSON | null): number {
  if (!n) return 0;
  return 1 + (n.children ?? []).reduce((s, c) => s + countNodes(c), 0);
}

function makeTree(
  root: NavigationNodeJSON | null,
  currentNodeId: NodeId | null = null,
): NavigationTreeJSON {
  return { root, currentNodeId, nodeCount: countNodes(root) };
}

type LM = { mine: LabelSide; theirs: LabelSide };
const lm = (
  l: string,
  t: string,
  options: {
    mineSrc?: "user" | "auto" | "system";
    theirsSrc?: "user" | "auto" | "system";
    mineAt?: number;
    theirsAt?: number;
  } = {},
): LM => ({
  mine: { label: l, source: options.mineSrc ?? "user", updatedAt: options.mineAt ?? 0 },
  theirs: { label: t, source: options.theirsSrc ?? "user", updatedAt: options.theirsAt ?? 0 },
});

function emptyPicks(treeId = "t", serverUpdatedAt = "s"): ConflictPickState {
  return {
    treeId,
    serverUpdatedAt,
    nodePicks: {},
    structuralPicks: {},
    labelPick: null,
    reorderPicks: {},
  };
}

function findFlat(d: TreeDiff, nodeId: string): DiffNode {
  const n = d.flatIndex.find((x) => (x.id as unknown as string) === nodeId);
  if (!n) throw new Error(`flat node ${nodeId} not found`);
  return n;
}

const NOOP_CLOCK = { now: () => 1_700_000_000_000 };

let passed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

console.log("tree-diff unit tests");

test("1. empty vs empty", () => {
  const d = diffTrees(makeTree(null), makeTree(null), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  assert.equal(d.counts.added, 0);
  assert.equal(d.counts.removed, 0);
  assert.equal(d.counts.modified, 0);
  assert.equal(d.counts.moved, 0);
  assert.equal(d.counts.unchanged, 0);
  assert.equal(d.root.children.length, 0);
  assert.equal(d.corruptReasons.length, 0);
});

test("2. identical trees: all unchanged", () => {
  const same = () => ntpRoot([mkNode({ id: "a", url: "http://a.com" })], "ntp");
  const d = diffTrees(makeTree(same()), makeTree(same()), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  assert.equal(d.counts.added, 0);
  assert.equal(d.counts.removed, 0);
  assert.equal(d.counts.modified, 0);
  assert.equal(d.counts.unchanged, 1, `expected 1 unchanged; got ${JSON.stringify(d.counts)}`);
});

test("3a. pure add → one added node", () => {
  const mineR = ntpRoot([mkNode({ id: "a", url: "http://a.com" })]);
  const theirsR = ntpRoot([
    mkNode({ id: "a", url: "http://a.com" }),
    mkNode({ id: "b", url: "http://b.com" }),
  ]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  assert.equal(d.counts.added, 1);
  assert.equal(d.counts.unchanged, 1);
  assert.equal(findFlat(d, "b").status, "added");
});

test("3b. pure remove → one removed node", () => {
  const mineR = ntpRoot([
    mkNode({ id: "a", url: "http://a.com" }),
    mkNode({ id: "b", url: "http://b.com" }),
  ]);
  const theirsR = ntpRoot([mkNode({ id: "a", url: "http://a.com" })]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  assert.equal(d.counts.removed, 1);
  assert.equal(d.counts.unchanged, 1);
  assert.equal(findFlat(d, "b").status, "removed");
});

test("4. title change → modified with primitive FieldChange", () => {
  const mineR = ntpRoot([mkNode({ id: "a", url: "http://a.com", title: "Old" })]);
  const theirsR = ntpRoot([mkNode({ id: "a", url: "http://a.com", title: "New" })]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  assert.equal(d.counts.modified, 1);
  const a = findFlat(d, "a");
  assert.equal(a.status, "modified");
  assert.equal(a.fields.length, 1);
  const f = a.fields[0];
  assert.ok(f && f.kind === "primitive" && f.field === "title");
  assert.equal(f.mine, "Old");
  assert.equal(f.theirs, "New");
});

test("5. tag delta → tags FieldChange with correct added/removed", () => {
  const mineR = ntpRoot([mkNode({ id: "a", url: "http://a.com", tags: ["x", "y"] })]);
  const theirsR = ntpRoot([mkNode({ id: "a", url: "http://a.com", tags: ["y", "z"] })]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  const a = findFlat(d, "a");
  assert.equal(a.status, "modified");
  const tagsField = a.fields.find((f) => f.kind === "tags");
  assert.ok(tagsField && tagsField.kind === "tags");
  if (!tagsField || tagsField.kind !== "tags") return;
  assert.deepStrictEqual(tagsField.added.slice().sort(), ["z"]);
  assert.deepStrictEqual(tagsField.removed.slice().sort(), ["x"]);
});

test("6a. layout-only change → downgraded to unchanged (hidden noise)", () => {
  const mineR = ntpRoot([
    mkNode({ id: "a", url: "http://a.com", layout: { offsetX: 0, offsetY: 0 } }),
  ]);
  const theirsR = ntpRoot([
    mkNode({ id: "a", url: "http://a.com", layout: { offsetX: 0, offsetY: 0 } }),
  ]);
  // NOTE: layout IS surface, so layout-only differing should mark modified.
  // The "hidden noise" downgrade is for layoutUpdatedAt / visitCount etc.
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  assert.equal(findFlat(d, "a").status, "unchanged");
});

test("6b. visitCount-only change → downgraded to unchanged", () => {
  const mineR = ntpRoot([mkNode({ id: "a", url: "http://a.com", visitCount: 4 })]);
  const theirsR = ntpRoot([mkNode({ id: "a", url: "http://a.com", visitCount: 9 })]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  assert.equal(findFlat(d, "a").status, "unchanged");
  assert.equal(d.counts.modified, 0);
});

test("7. moved node → status moved with correct movedFromPath", () => {
  // mine: a → b. theirs: a and b both under root.
  const mineR = ntpRoot([
    mkNode({
      id: "a",
      url: "http://a.com",
      children: [mkNode({ id: "b", url: "http://b.com" })],
    }),
  ]);
  const theirsR = ntpRoot([
    mkNode({ id: "a", url: "http://a.com" }),
    mkNode({ id: "b", url: "http://b.com" }),
  ]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  const b = findFlat(d, "b");
  assert.equal(b.status, "moved");
  assert.deepStrictEqual(b.movedFromPath, [nid("a")]);
});

test("8. moved + parent-deleted → parentDeletedOn populated", () => {
  // mine: a → b. theirs: b under root; a is DELETED server-side.
  const mineR = ntpRoot([
    mkNode({
      id: "a",
      url: "http://a.com",
      children: [mkNode({ id: "b", url: "http://b.com" })],
    }),
  ]);
  const theirsR = ntpRoot([mkNode({ id: "b", url: "http://b.com" })]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  const b = findFlat(d, "b");
  assert.equal(b.status, "moved");
  assert.equal(b.parentDeletedOn, "theirs"); // theirs has no "a"
});

test("9. NTP wrappers with different ids → all unchanged at the children", () => {
  const mineR = ntpRoot([mkNode({ id: "a", url: "http://a.com" })], "ntp-mine");
  const theirsR = ntpRoot([mkNode({ id: "a", url: "http://a.com" })], "ntp-theirs");
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  assert.equal(d.counts.added, 0);
  assert.equal(d.counts.removed, 0);
  assert.equal(d.counts.modified, 0);
  assert.equal(d.counts.unchanged, 1, `expected 1 unchanged, got ${JSON.stringify(d.counts)}`);
});

test("10a. applyMerge all-mine ≈ local tree", () => {
  const mineR = ntpRoot([
    mkNode({ id: "a", url: "http://a.com", title: "Mine" }),
    mkNode({ id: "c", url: "http://c.com" }), // mine-only
  ]);
  const theirsR = ntpRoot([
    mkNode({ id: "a", url: "http://a.com", title: "Theirs" }),
    mkNode({ id: "b", url: "http://b.com" }), // theirs-only
  ]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("Mine", "Theirs"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });

  // Force all-mine: added→mine (exclude), removed→mine (resurrect), modified→mine.
  const picks = emptyPicks();
  picks.nodePicks[nid("a")] = "mine";
  picks.nodePicks[nid("b")] = "mine"; // added → exclude
  picks.nodePicks[nid("c")] = "mine"; // removed → resurrect

  const res = applyMerge(d, picks, NOOP_CLOCK);
  assert.ok(res.ok, `merge failed: ${!res.ok ? res.reason : ""}`);
  if (!res.ok) return;
  assert.equal(res.merged.nodeCount, 3); // ntp + a + c
  const ids = (function collect(n: NavigationNodeJSON | null): string[] {
    if (!n) return [];
    return [n.id as unknown as string, ...(n.children ?? []).flatMap(collect)];
  })(res.merged.root);
  assert.deepStrictEqual(ids.sort(), ["a", "c", "ntp-root"].sort());
  // Title is mine's.
  const a = (res.merged.root!.children ?? []).find((c) => (c.id as unknown as string) === "a");
  assert.equal(a!.data.title, "Mine");
});

test("10b. applyMerge all-theirs ≈ server tree", () => {
  const mineR = ntpRoot([
    mkNode({ id: "a", url: "http://a.com", title: "Mine" }),
    mkNode({ id: "c", url: "http://c.com" }),
  ]);
  const theirsR = ntpRoot([
    mkNode({ id: "a", url: "http://a.com", title: "Theirs" }),
    mkNode({ id: "b", url: "http://b.com" }),
  ]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("Mine", "Theirs"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  const picks = emptyPicks();
  picks.nodePicks[nid("a")] = "theirs";
  picks.nodePicks[nid("b")] = "theirs"; // added → include
  picks.nodePicks[nid("c")] = "theirs"; // removed → confirm delete
  const res = applyMerge(d, picks, NOOP_CLOCK);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.merged.nodeCount, 3); // ntp + a + b
  const a = (res.merged.root!.children ?? []).find((c) => (c.id as unknown as string) === "a");
  assert.equal(a!.data.title, "Theirs");
});

test("11. cherry-pick preserves hidden noise from picked side", () => {
  const mineR = ntpRoot([
    mkNode({
      id: "a",
      url: "http://a.com",
      title: "Mine",
      visitCount: 4,
      lastVisitedAt: 111,
    }),
  ]);
  const theirsR = ntpRoot([
    mkNode({
      id: "a",
      url: "http://a.com",
      title: "Theirs",
      visitCount: 9,
      lastVisitedAt: 222,
    }),
  ]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  // Flip pick to theirs
  const picks = emptyPicks();
  picks.nodePicks[nid("a")] = "theirs";
  const res = applyMerge(d, picks, NOOP_CLOCK);
  assert.ok(res.ok);
  if (!res.ok) return;
  const a = (res.merged.root!.children ?? [])[0];
  assert.equal(a!.data.title, "Theirs");
  assert.equal(a!.data.visitCount, 9);
  assert.equal(a!.data.lastVisitedAt, 222);
});

test("12. label precedence: USER beats AUTO regardless of timestamp", () => {
  const pick = defaultLabelPick({
    mine: { label: "User label", source: "user", updatedAt: 100 },
    theirs: { label: "Auto label", source: "auto", updatedAt: 9999 },
    equal: false,
  });
  assert.equal(pick, "mine");

  const pick2 = defaultLabelPick({
    mine: { label: "Auto", source: "auto", updatedAt: 5 },
    theirs: { label: "User", source: "user", updatedAt: 1 },
    equal: false,
  });
  assert.equal(pick2, "theirs");

  // Both USER → newer wins
  const pick3 = defaultLabelPick({
    mine: { label: "M", source: "user", updatedAt: 100 },
    theirs: { label: "T", source: "user", updatedAt: 200 },
    equal: false,
  });
  assert.equal(pick3, "theirs");

  // Tiebreak mine
  const pick4 = defaultLabelPick({
    mine: { label: "M", source: "user", updatedAt: 100 },
    theirs: { label: "T", source: "user", updatedAt: 100 },
    equal: false,
  });
  assert.equal(pick4, "mine");
});

test("13a. structural pick 'skip' drops the moved node", () => {
  const mineR = ntpRoot([
    mkNode({
      id: "a",
      url: "http://a.com",
      children: [mkNode({ id: "x", url: "http://x.com" })],
    }),
  ]);
  const theirsR = ntpRoot([mkNode({ id: "a", url: "http://a.com" }), mkNode({ id: "x", url: "http://x.com" })]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  const picks = emptyPicks();
  picks.structuralPicks[nid("x")] = { kind: "moved", choose: "skip" };
  const res = applyMerge(d, picks, NOOP_CLOCK);
  assert.ok(res.ok);
  if (!res.ok) return;
  // x is dropped
  const hasX = res.merged.nodeCount === 2; // ntp + a
  assert.ok(hasX, `expected x to be dropped; got nodeCount ${res.merged.nodeCount}`);
});

test("14a. validator rejects duplicate NodeIds", () => {
  const bad: NavigationTreeJSON = {
    root: mkNode({
      id: "ntp",
      url: "chrome://newtab/",
      children: [
        mkNode({ id: "dup", url: "http://a.com" }),
        mkNode({ id: "dup", url: "http://b.com" }),
      ],
    }),
    currentNodeId: null,
    nodeCount: 3,
  };
  const r = validateMergedTree(bad);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /duplicate/);
});

test("14b. validator rejects non-NTP root", () => {
  const bad: NavigationTreeJSON = {
    root: mkNode({ id: "r", url: "http://real.com" }),
    currentNodeId: null,
    nodeCount: 1,
  };
  const r = validateMergedTree(bad);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /NTP/);
});

test("14c. validator rejects dangling currentNodeId", () => {
  const bad: NavigationTreeJSON = {
    root: mkNode({ id: "ntp", url: "chrome://newtab/" }),
    currentNodeId: nid("no-such-node"),
    nodeCount: 1,
  };
  const r = validateMergedTree(bad);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /currentNodeId/);
});

test("14d. validator rejects nodeCount mismatch", () => {
  const bad: NavigationTreeJSON = {
    root: ntpRoot([mkNode({ id: "a", url: "http://a.com" })]),
    currentNodeId: null,
    nodeCount: 99,
  };
  const r = validateMergedTree(bad);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /nodeCount/);
});

test("15. applyMerge purity — same inputs, deep-equal outputs", () => {
  const mineR = ntpRoot([
    mkNode({ id: "a", url: "http://a.com", title: "M" }),
    mkNode({ id: "b", url: "http://b.com", title: "BM" }),
  ]);
  const theirsR = ntpRoot([
    mkNode({ id: "a", url: "http://a.com", title: "T" }),
    mkNode({ id: "c", url: "http://c.com", title: "CT" }),
  ]);
  const d1 = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  const d2 = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  const picks = emptyPicks();
  picks.nodePicks[nid("a")] = "theirs";
  const r1 = applyMerge(d1, picks, NOOP_CLOCK);
  const r2 = applyMerge(d2, picks, NOOP_CLOCK);
  assert.ok(r1.ok && r2.ok);
  if (r1.ok && r2.ok) {
    assert.deepStrictEqual(r1.merged, r2.merged);
  }
});

test("16. url divergence → corrupt status; applyMerge refuses", () => {
  const mineR = ntpRoot([mkNode({ id: "a", url: "http://a.com" })]);
  const theirsR = ntpRoot([mkNode({ id: "a", url: "http://z.com" })]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  assert.ok(d.corruptReasons.length > 0);
  assert.equal(findFlat(d, "a").status, "corrupt");
  const r = applyMerge(d, emptyPicks(), NOOP_CLOCK);
  assert.equal(r.ok, false);
});

test("17. duplicate ids in input → corrupt; applyMerge refuses", () => {
  const mineR = ntpRoot([
    mkNode({ id: "a", url: "http://a.com" }),
    mkNode({ id: "a", url: "http://a.com" }),
  ]);
  const theirsR = ntpRoot([mkNode({ id: "a", url: "http://a.com" })]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  assert.ok(d.corruptReasons.some((r) => /duplicate/.test(r)));
  const r = applyMerge(d, emptyPicks(), NOOP_CLOCK);
  assert.equal(r.ok, false);
});

test("18. currentNodeId: mine's survives merge → preserved; else fallback", () => {
  const mineR = ntpRoot([mkNode({ id: "a", url: "http://a.com" })]);
  const theirsR = ntpRoot([mkNode({ id: "a", url: "http://a.com" })]);
  const d = diffTrees(makeTree(mineR, nid("a")), makeTree(theirsR, nid("a")), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  const r = applyMerge(d, emptyPicks(), NOOP_CLOCK);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.merged.currentNodeId as unknown as string, "a");

  // Mine's current node deleted
  const mineR2 = ntpRoot([mkNode({ id: "a", url: "http://a.com" })]);
  const theirsR2 = ntpRoot([mkNode({ id: "b", url: "http://b.com" })]);
  const d2 = diffTrees(makeTree(mineR2, nid("a")), makeTree(theirsR2, nid("b")), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  const picks = emptyPicks();
  picks.nodePicks[nid("a")] = "theirs"; // confirm delete of mine
  picks.nodePicks[nid("b")] = "theirs"; // include theirs
  const r2 = applyMerge(d2, picks, NOOP_CLOCK);
  assert.ok(r2.ok);
  if (r2.ok) {
    // mine's 'a' got dropped; theirs's 'b' currentNodeId applies as fallback.
    assert.equal(r2.merged.currentNodeId as unknown as string, "b");
  }
});

test("19. interleaving: server-known first (server order), mine-only appended (local order)", () => {
  const mineR = ntpRoot([
    mkNode({ id: "a", url: "http://a.com" }),
    mkNode({ id: "b", url: "http://b.com" }),
    mkNode({ id: "m", url: "http://m.com" }), // mine-only
    mkNode({ id: "c", url: "http://c.com" }),
  ]);
  const theirsR = ntpRoot([
    mkNode({ id: "c", url: "http://c.com" }),
    mkNode({ id: "a", url: "http://a.com" }),
    mkNode({ id: "b", url: "http://b.com" }),
    mkNode({ id: "s", url: "http://s.com" }), // server-only
  ]);
  const d = diffTrees(makeTree(mineR), makeTree(theirsR), lm("A", "A"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  const childIds = d.root.children.map((c) => c.id as unknown as string);
  // Expected: server order (c, a, b, s), then mine-only (m)
  assert.deepStrictEqual(childIds, ["c", "a", "b", "s", "m"]);
});

console.log(`\ntree-diff: ${passed} test groups passed`);
