import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createLayoutCacheContext,
  createLayoutCacheKey,
  pruneLayoutCacheEntries,
  type LayoutPositionsCacheEntry,
} from "../src/background/services/layout-cache-signature.js";

const ROOT = new URL("..", import.meta.url).pathname;

function readSource(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

function testLayoutCacheKeyIncludesAllFields(): void {
  const settings = {
    layout: { mode: "tree" as const },
    graphDensity: "comfortable" as const,
  };

  const base = createLayoutCacheContext("tree-a", 101, settings);
  const same = createLayoutCacheKey(base);

  assert.equal(same, "tree-a|101|tree|comfortable");
  assert.notEqual(same, createLayoutCacheKey(createLayoutCacheContext("tree-b", 101, settings)));
  assert.notEqual(same, createLayoutCacheKey(createLayoutCacheContext("tree-a", 202, settings)));
  assert.notEqual(
    same,
    createLayoutCacheKey(
      createLayoutCacheContext("tree-a", 101, {
        layout: { mode: "mindmap" },
        graphDensity: "comfortable",
      }),
    ),
  );
  assert.notEqual(
    same,
    createLayoutCacheKey(
      createLayoutCacheContext("tree-a", 101, {
        layout: { mode: "tree" },
        graphDensity: "compact",
      }),
    ),
  );

  console.log("  layout cache key: OK");
}

function testPruneLayoutCacheEntriesReplacesSameLayoutFamily(): void {
  const target = createLayoutCacheContext("tree-a", 200, {
    layout: { mode: "tree" },
    graphDensity: "comfortable",
  });
  const staleSameFamilyKey = createLayoutCacheKey(
    createLayoutCacheContext("tree-a", 100, {
      layout: { mode: "tree" },
      graphDensity: "comfortable",
    }),
  );
  const keepOtherModeKey = createLayoutCacheKey(
    createLayoutCacheContext("tree-a", 100, {
      layout: { mode: "mindmap" },
      graphDensity: "comfortable",
    }),
  );
  const keepOtherTreeKey = createLayoutCacheKey(
    createLayoutCacheContext("tree-b", 100, {
      layout: { mode: "tree" },
      graphDensity: "comfortable",
    }),
  );

  const entries: Record<string, LayoutPositionsCacheEntry> = {
    [staleSameFamilyKey]: {
      ...createLayoutCacheContext("tree-a", 100, {
        layout: { mode: "tree" },
        graphDensity: "comfortable",
      }),
      positions: { "1": { x: 0, y: 0 } },
    },
    [keepOtherModeKey]: {
      ...createLayoutCacheContext("tree-a", 100, {
        layout: { mode: "mindmap" },
        graphDensity: "comfortable",
      }),
      positions: { "2": { x: 1, y: 1 } },
    },
    [keepOtherTreeKey]: {
      ...createLayoutCacheContext("tree-b", 100, {
        layout: { mode: "tree" },
        graphDensity: "comfortable",
      }),
      positions: { "3": { x: 2, y: 2 } },
    },
  };

  const next = pruneLayoutCacheEntries(entries, target);

  assert.equal(staleSameFamilyKey in next, false);
  assert.equal(keepOtherModeKey in next, true);
  assert.equal(keepOtherTreeKey in next, true);

  console.log("  layout cache pruning: OK");
}

function testBackgroundUsesTreeLayoutAndInlineCompute(): void {
  const precomputeSource = readSource("src/background/services/layout-precompute.ts");
  // `tree-handlers.ts` was split — the snapshot path moved into
  // `snapshots.ts` and the lifecycle handlers consume it from there.
  const snapshotsSource = readSource("src/background/messaging/handlers/snapshots.ts");
  const lifecycleSource = readSource(
    "src/background/messaging/handlers/tree-lifecycle-handlers.ts",
  );
  const deleteSource = readSource("src/background/messaging/handlers/node-delete-handlers.ts");
  const layoutHandlersSource = readSource(
    "src/background/messaging/handlers/node-layout-handlers.ts",
  );
  const notificationsSource = readSource("src/background/messaging/notifications.ts");

  assert.match(precomputeSource, /computeTreePositionsRecord/);
  assert.doesNotMatch(precomputeSource, /elkjs/);
  assert.doesNotMatch(precomputeSource, /web-worker/);
  // Snapshot path inline-computes positions on cache miss so the
  // first TREE_UPDATED carries final coordinates. The legacy async
  // refinement push (`requestLayoutRefinement(treeJSON)` inside the
  // hot path) caused a second `applyTreeState` on the sidepanel per
  // mutation — ~90ms × N nodes of repeated React-Flow diff. Trace
  // evidence: post-fix navigation/new-tab no longer triggers
  // back-to-back long-tasks at +X / +X+82ms in the timeline.
  assert.match(snapshotsSource, /computePositions\(treeJSON, settings\)/);
  assert.match(snapshotsSource, /persistComputedPositions/);
  assert.match(notificationsSource, /computePositions\(treeJSON, settings\)/);
  assert.match(notificationsSource, /persistInlinePositions/);
  // `requestLayoutRefinement` still exists for the settings-change /
  // cache-warm callers; it must no longer fire from the hot
  // mutation/snapshot paths.
  assert.doesNotMatch(snapshotsSource, /requestLayoutRefinement\(/);
  assert.doesNotMatch(lifecycleSource, /requestLayoutRefinement\(/);
  assert.doesNotMatch(deleteSource, /requestLayoutRefinement\(/);
  assert.doesNotMatch(layoutHandlersSource, /requestLayoutRefinement\(/);
  assert.doesNotMatch(notificationsSource, /skipPrecompute/);

  console.log("  d3-hierarchy + inline-compute snapshot: OK");
}

function run(): void {
  console.log("Running layout-precompute-regression.test.ts...");
  testLayoutCacheKeyIncludesAllFields();
  testPruneLayoutCacheEntriesReplacesSameLayoutFamily();
  testBackgroundUsesTreeLayoutAndInlineCompute();
}

run();
console.log("layout-precompute-regression.test.ts passed");
