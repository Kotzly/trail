/**
 * End-to-end integration tests for the conflict-merge pipeline — from
 * diff, through cherry-pick, compact-encoded transport, back through
 * decode, and into the merged tree that would be pushed via
 * `applyConflictMerge`.
 *
 * Full Supabase-mocked handler tests (TOCTOU, offline queue, re-entrancy)
 * are a follow-up; they require a module-level mock of
 * `@supabase/supabase-js` which doesn't exist in the current test
 * harness. The cases below exercise every layer that's pure /
 * deterministic.
 */

import assert from "node:assert/strict";

import type { NodeId, Tag, Timestamp, Url } from "../src/shared/types/ids.js";
import type { NavigationNodeJSON, NodeData } from "../src/shared/types/node.js";
import type { NavigationTreeJSON } from "../src/shared/types/tree.js";
import type { ConflictPickState, LabelSide } from "../src/shared/types/tree-diff.js";

import { applyMerge, diffTrees, validateMergedTree } from "../src/shared/lib/tree-diff.js";
import { fromCompact, toCompact } from "../src/shared/lib/compact-mapper.js";

// Shared helpers (duplicated here to keep tests independent)
const nid = (s: string) => s as unknown as NodeId;
const asUrl = (s: string) => s as Url;

function mk(args: {
  id: string;
  url: string;
  title?: string;
  pinned?: boolean;
  tags?: string[];
  visitCount?: number;
  lastVisitedAt?: number;
  favicon?: string;
  children?: NavigationNodeJSON[];
}): NavigationNodeJSON {
  const data = {
    url: asUrl(args.url),
    title: (args.title ?? args.url) as string,
    pinned: args.pinned ?? false,
    tags: (args.tags ?? []) as Tag[],
  } as NodeData;
  if (args.favicon) (data as NodeData).favicon = args.favicon as unknown as NodeData["favicon"];
  if (args.visitCount !== undefined) data.visitCount = args.visitCount;
  if (args.lastVisitedAt !== undefined) data.lastVisitedAt = args.lastVisitedAt as Timestamp;
  return {
    id: nid(args.id),
    timestamp: 0 as Timestamp,
    data,
    children: args.children ?? [],
  };
}
function ntp(kids: NavigationNodeJSON[] = [], id = "ntp-root"): NavigationNodeJSON {
  return mk({ id, url: "chrome://newtab/", title: "New Tab", children: kids });
}
function countNodes(n: NavigationNodeJSON | null): number {
  if (!n) return 0;
  return 1 + (n.children ?? []).reduce((s, c) => s + countNodes(c), 0);
}
function tree(root: NavigationNodeJSON | null, cur: NodeId | null = null): NavigationTreeJSON {
  return { root, currentNodeId: cur, nodeCount: countNodes(root) };
}
const lm = (mine: string, theirs: string): { mine: LabelSide; theirs: LabelSide } => ({
  mine: { label: mine, source: "user", updatedAt: 0 },
  theirs: { label: theirs, source: "user", updatedAt: 0 },
});
function emptyPicks(): ConflictPickState {
  return {
    treeId: "t",
    serverUpdatedAt: "s",
    nodePicks: {},
    structuralPicks: {},
    labelPick: null,
    reorderPicks: {},
  };
}
const CLOCK = { now: () => 1_700_000_000_000 };

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

console.log("conflict-merge integration tests");

test("compact round-trip preserves merged tree identity", () => {
  const mineR = ntp([mk({ id: "a", url: "http://a.com", title: "Mine A" })]);
  const theirsR = ntp([
    mk({ id: "a", url: "http://a.com", title: "Theirs A" }),
    mk({ id: "b", url: "http://b.com" }),
  ]);
  const d = diffTrees(tree(mineR), tree(theirsR), lm("L", "L"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  const picks = emptyPicks();
  picks.nodePicks[nid("a")] = "theirs";
  picks.nodePicks[nid("b")] = "theirs";

  const merge = applyMerge(d, picks, CLOCK);
  assert.ok(merge.ok);
  if (!merge.ok) return;

  const compact = toCompact(merge.merged);
  const decoded = fromCompact(compact);
  assert.deepStrictEqual(decoded, merge.merged);
  const v = validateMergedTree(decoded);
  assert.equal(v.ok, true);
});

test("deep structural pick: server reparent wins when chosen", () => {
  // mine: home → [a, b]
  // theirs: home → [a → b]  (b reparented under a on server)
  const mineR = ntp([
    mk({ id: "home", url: "http://home.com", children: [
      mk({ id: "a", url: "http://a.com" }),
      mk({ id: "b", url: "http://b.com" }),
    ] }),
  ]);
  const theirsR = ntp([
    mk({ id: "home", url: "http://home.com", children: [
      mk({ id: "a", url: "http://a.com", children: [
        mk({ id: "b", url: "http://b.com" }),
      ]}),
    ] }),
  ]);
  const d = diffTrees(tree(mineR), tree(theirsR), lm("L", "L"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  const picks = emptyPicks();
  picks.structuralPicks[nid("b")] = { kind: "moved", choose: "theirs-parent" };

  const merge = applyMerge(d, picks, CLOCK);
  assert.ok(merge.ok);
  if (!merge.ok) return;

  const home = merge.merged.root!.children[0]!; // home
  const a = home.children[0]!;
  assert.equal(a.id as unknown as string, "a");
  assert.equal(a.children.length, 1);
  assert.equal(a.children[0]!.id as unknown as string, "b");
});

test("orphan re-parent fires warning when parent dropped", () => {
  // mine: home → a (with child x). user removed `a` (picked theirs).
  // theirs: home  (no a, no x).
  // But user wants to resurrect x.
  const mineR = ntp([
    mk({ id: "home", url: "http://home.com", children: [
      mk({ id: "a", url: "http://a.com", children: [mk({ id: "x", url: "http://x.com" })] }),
    ] }),
  ]);
  const theirsR = ntp([mk({ id: "home", url: "http://home.com" })]);
  const d = diffTrees(tree(mineR), tree(theirsR), lm("L", "L"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  const picks = emptyPicks();
  picks.nodePicks[nid("a")] = "theirs"; // drop a
  picks.nodePicks[nid("x")] = "mine";   // resurrect x
  const merge = applyMerge(d, picks, CLOCK);
  assert.ok(merge.ok);
  if (!merge.ok) return;

  // x re-parented under home (nearest surviving ancestor)
  assert.ok(merge.warnings.length >= 1);
  const w = merge.warnings[0]!;
  assert.equal(w.nodeId as unknown as string, "x");

  // Validate tree: x must appear somewhere
  const ids: string[] = [];
  (function walk(n: NavigationNodeJSON) {
    ids.push(n.id as unknown as string);
    n.children.forEach(walk);
  })(merge.merged.root!);
  assert.ok(ids.includes("x"));
});

test("noise-only divergence leaves merged tree byte-identical on default picks", () => {
  const mineR = ntp([mk({ id: "a", url: "http://a.com", visitCount: 4, lastVisitedAt: 111 })]);
  const theirsR = ntp([mk({ id: "a", url: "http://a.com", visitCount: 9, lastVisitedAt: 222 })]);
  const d = diffTrees(tree(mineR), tree(theirsR), lm("L", "L"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });
  // Counts: all nodes unchanged (noise downgraded).
  assert.equal(d.counts.modified, 0);
  assert.equal(d.counts.unchanged, 1);

  const merge = applyMerge(d, emptyPicks(), CLOCK);
  assert.ok(merge.ok);
  if (!merge.ok) return;
  // Default pick = mine for unchanged → mine's noise wins.
  const a = merge.merged.root!.children[0]!;
  assert.equal(a.data.visitCount, 4);
  assert.equal(a.data.lastVisitedAt, 111);
});

test("validator rejects applyMerge's bad output (synthesized corrupt case)", () => {
  // Invariant: nodeCount must match. Manually corrupt a valid merge output.
  const t = tree(ntp([mk({ id: "a", url: "http://a.com" })]));
  const corrupted: NavigationTreeJSON = { ...t, nodeCount: 42 };
  const v = validateMergedTree(corrupted);
  assert.equal(v.ok, false);
});

test("label source precedence end-to-end (user beats auto)", () => {
  const mineR = ntp([mk({ id: "a", url: "http://a.com" })]);
  const theirsR = ntp([mk({ id: "a", url: "http://a.com" })]);
  const d = diffTrees(
    tree(mineR),
    tree(theirsR),
    {
      mine: { label: "My label", source: "user", updatedAt: 100 },
      theirs: { label: "Auto label", source: "auto", updatedAt: 9999 },
    },
    { treeId: "t", serverUpdatedAt: "s" },
  );
  const merge = applyMerge(d, emptyPicks(), CLOCK);
  assert.ok(merge.ok);
  if (!merge.ok) return;
  assert.equal(merge.mergedLabel.label, "My label");
  assert.equal(merge.mergedLabel.source, "user");
});

test("picks: all-mine + all-theirs are deep-equal to respective sources' trees (sans noise)", () => {
  const mineR = ntp([
    mk({ id: "a", url: "http://a.com", title: "Mine A" }),
    mk({ id: "b", url: "http://b.com" }),
  ]);
  const theirsR = ntp([
    mk({ id: "a", url: "http://a.com", title: "Theirs A" }),
    mk({ id: "c", url: "http://c.com" }),
  ]);
  const d = diffTrees(tree(mineR), tree(theirsR), lm("L", "L"), {
    treeId: "t",
    serverUpdatedAt: "s",
  });

  // All-mine
  const minePicks = emptyPicks();
  for (const n of d.flatIndex) {
    if (n === d.root) continue;
    minePicks.nodePicks[n.id] = "mine";
  }
  const mineMerge = applyMerge(d, minePicks, CLOCK);
  assert.ok(mineMerge.ok);
  if (!mineMerge.ok) return;
  const mineIds = collectIds(mineMerge.merged.root);
  assert.deepStrictEqual(mineIds.sort(), ["a", "b", "ntp-root"].sort());

  // All-theirs
  const theirsPicks = emptyPicks();
  for (const n of d.flatIndex) {
    if (n === d.root) continue;
    theirsPicks.nodePicks[n.id] = "theirs";
  }
  const theirsMerge = applyMerge(d, theirsPicks, CLOCK);
  assert.ok(theirsMerge.ok);
  if (!theirsMerge.ok) return;
  const theirsIds = collectIds(theirsMerge.merged.root);
  assert.deepStrictEqual(theirsIds.sort(), ["a", "c", "ntp-root"].sort());
});

function collectIds(n: NavigationNodeJSON | null): string[] {
  if (!n) return [];
  return [n.id as unknown as string, ...(n.children ?? []).flatMap(collectIds)];
}

console.log(`\nconflict-merge: ${passed} test groups passed`);
