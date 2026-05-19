/**
 * SearchIndex contract tests — locks behavior after the OOP→JSON
 * migration. The index now consumes a `TreeIndex` instead of a
 * `NavigationTree`; entry shape (id, title, url, baseScore) and ranking
 * (visit frequency + exp-decay recency) must remain identical.
 */
import assert from "node:assert/strict";
import { SearchIndex } from "../src/apps/sidepanel/ui/components/command-palette-search.js";
import { buildTreeIndex } from "../src/apps/sidepanel/ui/state/tree-index.js";
import {
  asNodeId,
  now,
  type NodeId,
  type Timestamp,
  type Title,
  type Url,
} from "../src/shared/types/ids.js";
import type { NavigationNodeJSON, NodeData } from "../src/shared/types/node.js";
import type { NavigationTreeJSON } from "../src/shared/types/tree.js";

let nextId = 0;
function id(): NodeId {
  nextId += 1;
  return asNodeId(`n${nextId}`);
}

function n(
  url: string,
  title: string,
  children: NavigationNodeJSON[] = [],
  extra: Partial<NodeData> = {},
): NavigationNodeJSON {
  return {
    id: id(),
    timestamp: now() as Timestamp,
    data: {
      url: url as Url,
      title: title as Title,
      pinned: false,
      tags: [],
      ...extra,
    } as NodeData,
    children,
  };
}

function tree(root: NavigationNodeJSON): NavigationTreeJSON {
  let count = 0;
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    count += 1;
    for (const child of node.children) stack.push(child);
  }
  return { root, currentNodeId: null, nodeCount: count };
}

function testEmptyQueryReturnsTopByBase(): void {
  nextId = 0;
  const NOW = 1_700_000_000_000;
  const docs = n("chrome://newtab/", "New Tab", [
    n("https://low.example/", "Low score", [], { visitCount: 1, lastVisitedAt: NOW as Timestamp }),
    n("https://hi.example/", "Hi score", [], { visitCount: 50, lastVisitedAt: NOW as Timestamp }),
  ]);
  const idx = buildTreeIndex(tree(docs));
  const search = new SearchIndex(idx, NOW);

  const out = search.search("", 10);
  assert.ok(out.length >= 2);
  // Top-ranked must be the hi-score entry.
  assert.equal(out[0]!.title, "Hi score", "empty query → top-by-baseScore");
  console.log("  empty query top-by-base: OK");
}

function testPrefixMatch(): void {
  nextId = 0;
  const NOW = 1_700_000_000_000;
  const docs = n("chrome://newtab/", "New Tab", [
    n("https://github.com/", "GitHub home"),
    n("https://gitlab.com/", "GitLab"),
    n("https://example.com/", "Example"),
  ]);
  const idx = buildTreeIndex(tree(docs));
  const search = new SearchIndex(idx, NOW);

  const out = search.search("git", 10);
  const titles = out.map((e) => e.title);
  assert.ok(titles.includes("GitHub home"), "prefix matches GitHub");
  assert.ok(titles.includes("GitLab"), "prefix matches GitLab");
  assert.ok(!titles.includes("Example"), "prefix doesn't match Example");
  console.log("  prefix match: OK");
}

function testLimitRespected(): void {
  nextId = 0;
  const docs = n("chrome://newtab/", "New Tab", [
    n("https://a.example/", "Alpha"),
    n("https://b.example/", "Beta"),
    n("https://c.example/", "Gamma"),
    n("https://d.example/", "Delta"),
  ]);
  const idx = buildTreeIndex(tree(docs));
  const search = new SearchIndex(idx);
  assert.equal(search.search("", 2).length, 2, "limit caps empty-query results");
  console.log("  limit respected: OK");
}

function testEntriesIncludeIdAndScore(): void {
  nextId = 0;
  const NOW = 1_700_000_000_000;
  const child = n("https://only.example/", "Only", [], {
    visitCount: 7,
    lastVisitedAt: NOW as Timestamp,
  });
  const docs = n("chrome://newtab/", "New Tab", [child]);
  const idx = buildTreeIndex(tree(docs));
  const search = new SearchIndex(idx, NOW);
  const [top] = search.topByBase;
  // baseScore must reflect log1p(visitCount) + recency=1 at lastAt===now.
  const expected = Math.log1p(7) + 1; // recency exp(0) = 1
  // topByBase is sorted by baseScore desc; first entry is the highest scorer.
  assert.ok(top, "topByBase non-empty");
  assert.ok(top.id, "entry has id");
  // The hi-score one should be the child (7 visits) not the root (0 visits).
  assert.equal(top.id, child.id);
  assert.ok(Math.abs(top.baseScore - expected) < 0.001, "baseScore matches formula");
  console.log("  entry shape + score: OK");
}

function run(): void {
  console.log("Running command-palette-search.test.ts...");
  testEmptyQueryReturnsTopByBase();
  testPrefixMatch();
  testLimitRespected();
  testEntriesIncludeIdAndScore();
}

run();
console.log("command-palette-search.test.ts passed");
