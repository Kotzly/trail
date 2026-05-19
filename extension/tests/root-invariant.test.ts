import assert from "node:assert/strict";
import { NavigationTree } from "../src/background/state/nav-tree.js";
import { NavigationTreeMapper } from "../src/shared/lib/mapper.js";
import {
  NEW_TAB_ROOT_URL,
  NEW_TAB_ROOT_TITLE,
  buildNewTabRootData,
  isNewTabUrl,
} from "../src/shared/lib/root.js";
import {
  asNodeId,
  now,
  type NodeId,
  type Timestamp,
  type Title,
  type Url,
} from "../src/shared/types/ids.js";
import type { NavigationTreeJSON } from "../src/shared/types/tree.js";
import type { NodeData, NavigationNodeJSON } from "../src/shared/types/node.js";
import { uuidv7 } from "../src/shared/lib/uuid.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeId(): NodeId {
  return asNodeId(uuidv7());
}

function makeNodeJSON(
  url: string,
  title: string,
  children: NavigationNodeJSON[] = [],
): NavigationNodeJSON {
  return {
    id: makeId(),
    timestamp: now() as Timestamp,
    data: {
      url: url as Url,
      title: title as Title,
      pinned: false,
      tags: [],
    } satisfies NodeData,
    children,
  };
}

function dataFor(url: string, title: string): NodeData {
  return {
    url: url as Url,
    title: title as Title,
    pinned: false,
    tags: [],
  };
}

// ---------------------------------------------------------------------------
// isNewTabUrl — pattern coverage
// ---------------------------------------------------------------------------

function testIsNewTabUrl(): void {
  // Positive cases
  assert(isNewTabUrl("chrome://newtab/"), "chrome://newtab/");
  assert(isNewTabUrl("chrome://newtab"), "chrome://newtab (no slash)");
  assert(isNewTabUrl("edge://newtab/"), "edge://newtab/");
  assert(isNewTabUrl("brave://newtab/"), "brave://newtab/");
  assert(isNewTabUrl("about:blank"), "about:blank");
  assert(isNewTabUrl("about:newtab"), "about:newtab");
  assert(isNewTabUrl("chrome-search://local-ntp/local-ntp.html"), "chrome-search NTP");
  // Negative cases
  assert(!isNewTabUrl("https://example.com"), "https://example.com rejected");
  assert(!isNewTabUrl("https://newtab.com"), "https://newtab.com rejected (real site)");
  assert(!isNewTabUrl("https://www.google.com/search?q=newtab"), "search URL containing 'newtab'");
  console.log("  isNewTabUrl: OK");
}

// ---------------------------------------------------------------------------
// buildNewTabRootData — factory returns fresh arrays
// ---------------------------------------------------------------------------

function testBuildNewTabRootDataFreshness(): void {
  const a = buildNewTabRootData();
  const b = buildNewTabRootData();
  assert.notEqual(a.tags, b.tags, "each call returns a fresh tags array");
  // Mutating one must not affect the other — critical because the same
  // factory is called for two different trees.
  a.tags.push("mutated" as never);
  assert.equal(b.tags.length, 0, "mutation of one result does not bleed into another");
  assert.equal(a.url, NEW_TAB_ROOT_URL);
  assert.equal(a.title, NEW_TAB_ROOT_TITLE);
  console.log("  buildNewTabRootData freshness: OK");
}

// ---------------------------------------------------------------------------
// Chokepoint — navigateUnder wraps non-NTP root under synthetic NTP
// ---------------------------------------------------------------------------

function testNavigateEmptyTreeWithNonNtpUrl(): void {
  const tree = new NavigationTree();
  const landed = tree.navigate(dataFor("https://example.com/", "Example"));

  const root = tree.getRoot();
  assert(root, "root exists after navigate");
  assert.equal(root.data.url, NEW_TAB_ROOT_URL, "root is the synthetic NTP");
  assert.equal(root.data.title, NEW_TAB_ROOT_TITLE, "root title is canonical");
  assert.equal(landed.data.url, "https://example.com/", "landed node is the real URL");
  assert.equal(landed.getParent()?.id, root.id, "landed is a direct child of root");
  assert.equal(tree.getCurrent()?.id, landed.id, "current follows the landed node (setAsCurrent=true)");
  assert.equal(tree.size(), 2, "tree has root + child");
  console.log("  navigate(non-NTP) on empty tree wraps: OK");
}

function testNavigateEmptyTreeWithNtpUrl(): void {
  const tree = new NavigationTree();
  const landed = tree.navigate(dataFor("chrome://newtab/", "New Tab"));

  const root = tree.getRoot();
  assert(root, "root exists");
  assert.equal(root.id, landed.id, "no wrap — incoming NTP becomes root directly");
  assert.equal(tree.size(), 1, "tree has only root");
  console.log("  navigate(NTP) on empty tree does not wrap: OK");
}

function testNavigateUnderNullSetAsCurrentFalseWraps(): void {
  // Mirrors `reviveFromTombstone`: parentId=null, setAsCurrent=false,
  // tree is empty. Old behaviour made tombstone URL the root. New
  // behaviour wraps under NTP, returns the child, current stays on
  // the synthetic root.
  const tree = new NavigationTree();
  const revived = tree.navigateUnder(null, dataFor("https://example.com/x", "X"), {
    setAsCurrent: false,
  });

  const root = tree.getRoot();
  assert(root, "root exists");
  assert.equal(root.data.url, NEW_TAB_ROOT_URL, "synthetic NTP root");
  assert.equal(revived.data.url, "https://example.com/x", "revived is the real URL");
  assert.equal(tree.getCurrent()?.id, root.id, "current stays on synthetic root when setAsCurrent=false");
  console.log("  navigateUnder(null, ..., {setAsCurrent:false}) wraps: OK");
}

// ---------------------------------------------------------------------------
// Mapper wrap — fromJSON wraps non-NTP root and preserves currentNodeId
// ---------------------------------------------------------------------------

function testFromJsonWithNtpRootIsNoop(): void {
  const rootJson = makeNodeJSON("chrome://newtab/", "New Tab", [
    makeNodeJSON("https://example.com", "Example"),
  ]);
  const json: NavigationTreeJSON = {
    root: rootJson,
    currentNodeId: rootJson.children[0]!.id,
    nodeCount: 2,
  };

  const tree = NavigationTreeMapper.fromTrustedJSON(json);
  assert(tree.getRoot(), "root exists");
  assert.equal(tree.getRoot()!.id, rootJson.id, "NTP root id is preserved — no wrap");
  assert.equal(tree.size(), 2, "node count unchanged");
  assert.equal(tree.getCurrent()?.id, rootJson.children[0]!.id, "current preserved");
  console.log("  fromJSON(NTP root) is no-op: OK");
}

function testFromJsonWrapsNonNtpRoot(): void {
  const originalRoot = makeNodeJSON("https://example.com/", "Example", [
    makeNodeJSON("https://example.com/a", "A"),
    makeNodeJSON("https://example.com/b", "B"),
  ]);
  const json: NavigationTreeJSON = {
    root: originalRoot,
    currentNodeId: originalRoot.id,
    nodeCount: 3,
  };

  const tree = NavigationTreeMapper.fromTrustedJSON(json);
  const root = tree.getRoot();
  assert(root, "root exists");
  assert.equal(root.data.url, NEW_TAB_ROOT_URL, "synthetic NTP wrapper is root");
  assert.notEqual(root.id, originalRoot.id, "wrapper has fresh id");

  // Original root is preserved as first child, with its own id + subtree.
  const firstChild = root.getChildren()[0];
  assert(firstChild, "wrapper has first child");
  assert.equal(firstChild.id, originalRoot.id, "original root keeps its id");
  assert.equal(firstChild.data.url, "https://example.com/", "original URL preserved");
  assert.equal(firstChild.getChildren().length, 2, "grandchildren preserved");
  assert.equal(tree.size(), 4, "node count incremented by wrapper (3 → 4)");
  console.log("  fromJSON wraps non-NTP root: OK");
}

function testFromJsonPreservesCurrentNodeIdAfterWrap(): void {
  // currentNodeId pointed at the old root. After wrap, that id now
  // lives on a child (formerly root). setCurrentById should resolve
  // correctly; current must NOT silently fall back to the new wrapper.
  const originalRoot = makeNodeJSON("https://example.com/", "Example");
  const json: NavigationTreeJSON = {
    root: originalRoot,
    currentNodeId: originalRoot.id,
    nodeCount: 1,
  };

  const tree = NavigationTreeMapper.fromTrustedJSON(json);
  const current = tree.getCurrent();
  assert(current, "current resolves");
  assert.equal(current.id, originalRoot.id, "current still points at old root by id");
  assert.notEqual(current.id, tree.getRoot()!.id, "current is NOT the new wrapper");
  assert.equal(current.data.url, "https://example.com/", "current has old root's data");
  console.log("  fromJSON preserves currentNodeId across wrap: OK");
}

function testFromJsonWithMissingCurrentFallsBackToRoot(): void {
  // Edge case: currentNodeId was set to a node that no longer exists
  // (merged/deleted before save). After load, current should fall
  // back to the root (the new wrapper, if wrap happened).
  const originalRoot = makeNodeJSON("https://example.com/", "Example");
  const strayId = makeId();
  const json: NavigationTreeJSON = {
    root: originalRoot,
    currentNodeId: strayId,
    nodeCount: 1,
  };

  const tree = NavigationTreeMapper.fromTrustedJSON(json);
  const current = tree.getCurrent();
  assert(current, "current resolves to fallback");
  assert.equal(current.id, tree.getRoot()!.id, "falls back to the wrapper root");
  console.log("  fromJSON falls back to root on missing currentNodeId: OK");
}

function testFromJsonEmptyTreeReturnsEmpty(): void {
  const json: NavigationTreeJSON = { root: null, currentNodeId: null, nodeCount: 0 };
  const tree = NavigationTreeMapper.fromTrustedJSON(json);
  assert.equal(tree.getRoot(), null, "empty tree stays empty");
  assert.equal(tree.size(), 0, "no nodes");
  console.log("  fromJSON(empty) stays empty: OK");
}

// ---------------------------------------------------------------------------
// Round trip — toJSON → fromJSON is stable once invariant holds
// ---------------------------------------------------------------------------

function testToJsonFromJsonRoundTrip(): void {
  const tree = new NavigationTree();
  tree.navigate(dataFor("https://example.com/", "Example"));
  tree.navigate(dataFor("https://example.com/child", "Child"));

  const json = NavigationTreeMapper.toJSON(tree);
  const rebuilt = NavigationTreeMapper.fromTrustedJSON(json);

  assert.equal(rebuilt.size(), tree.size(), "size preserved");
  assert.equal(rebuilt.getRoot()!.data.url, NEW_TAB_ROOT_URL, "root is NTP");
  assert.equal(rebuilt.getRoot()!.id, tree.getRoot()!.id, "root id preserved across round trip");
  assert.equal(
    rebuilt.getCurrent()?.id,
    tree.getCurrent()?.id,
    "currentNodeId preserved across round trip",
  );
  console.log("  toJSON → fromJSON round trip stable: OK");
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------

function run(): void {
  console.log("Running root-invariant.test.ts...");
  testIsNewTabUrl();
  testBuildNewTabRootDataFreshness();
  testNavigateEmptyTreeWithNonNtpUrl();
  testNavigateEmptyTreeWithNtpUrl();
  testNavigateUnderNullSetAsCurrentFalseWraps();
  testFromJsonWithNtpRootIsNoop();
  testFromJsonWrapsNonNtpRoot();
  testFromJsonPreservesCurrentNodeIdAfterWrap();
  testFromJsonWithMissingCurrentFallsBackToRoot();
  testFromJsonEmptyTreeReturnsEmpty();
  testToJsonFromJsonRoundTrip();
  console.log("root-invariant.test.ts passed");
}

run();
