import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTreeMaps, isValidDropTarget } from "../src/features/graph/reparent.js";
import type { NodeId } from "../src/shared/types/ids.js";
import type { NavigationTreeJSON } from "../src/shared/types/tree.js";
import type { NavigationNodeJSON } from "../src/shared/types/node.js";

const id = (n: number): NodeId => String(n) as unknown as NodeId;

function node(n: number, children: NavigationNodeJSON[] = []): NavigationNodeJSON {
  return {
    id: id(n),
    data: {
      url: `https://example.com/${n}` as NavigationNodeJSON["data"]["url"],
      title: `Node ${n}` as NavigationNodeJSON["data"]["title"],
      pinned: false,
    },
    children,
  } as NavigationNodeJSON;
}

/**
 * Tree shape:
 *
 *   1 (root)
 *   ├── 2
 *   │   └── 4
 *   │       └── 5
 *   └── 3
 */
function makeTree(): NavigationTreeJSON {
  return {
    root: node(1, [node(2, [node(4, [node(5)])]), node(3)]),
    nodeCount: 5,
  } as unknown as NavigationTreeJSON;
}

describe("buildTreeMaps", () => {
  it("returns empty maps for null tree", () => {
    const maps = buildTreeMaps(null);
    assert.equal(maps.rootId, null);
    assert.equal(maps.parentMap.size, 0);
  });

  it("captures every node and its parent", () => {
    const maps = buildTreeMaps(makeTree());
    assert.equal(maps.rootId, id(1));
    assert.equal(maps.parentMap.size, 5);
    assert.equal(maps.parentMap.get(id(1)), null);
    assert.equal(maps.parentMap.get(id(2)), id(1));
    assert.equal(maps.parentMap.get(id(3)), id(1));
    assert.equal(maps.parentMap.get(id(4)), id(2));
    assert.equal(maps.parentMap.get(id(5)), id(4));
  });
});

describe("isValidDropTarget", () => {
  const maps = buildTreeMaps(makeTree());

  it("rejects self-drop", () => {
    assert.equal(isValidDropTarget(maps, id(2), id(2)), false);
  });

  it("rejects reparenting the root", () => {
    assert.equal(isValidDropTarget(maps, id(1), id(2)), false);
  });

  it("rejects current parent (no-op)", () => {
    // 2 is already a child of 1
    assert.equal(isValidDropTarget(maps, id(2), id(1)), false);
    // 5 is already a child of 4
    assert.equal(isValidDropTarget(maps, id(5), id(4)), false);
  });

  it("rejects descendants (would create a cycle)", () => {
    // dropping 2 onto its descendants 4 or 5 would create a cycle
    assert.equal(isValidDropTarget(maps, id(2), id(4)), false);
    assert.equal(isValidDropTarget(maps, id(2), id(5)), false);
  });

  it("accepts moving a leaf to a sibling subtree", () => {
    // 5 → child of 3 is valid
    assert.equal(isValidDropTarget(maps, id(5), id(3)), true);
  });

  it("accepts moving a subtree to a sibling", () => {
    // 4 → child of 3 is valid (4 currently sits under 2)
    assert.equal(isValidDropTarget(maps, id(4), id(3)), true);
  });

  it("accepts moving a subtree to root", () => {
    // 4 → child of 1 (root) is valid
    assert.equal(isValidDropTarget(maps, id(4), id(1)), true);
  });

  it("rejects unknown ids", () => {
    assert.equal(isValidDropTarget(maps, id(99), id(1)), false);
    assert.equal(isValidDropTarget(maps, id(2), id(99)), false);
  });
});
