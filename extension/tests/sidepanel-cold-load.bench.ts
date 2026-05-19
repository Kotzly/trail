/**
 * Microbenchmark: pre-rewrite vs. post-rewrite sidepanel-side cold load.
 *
 * Synthesizes a 5,000-node navigation tree, then times:
 *
 *   • OLD path: `NavigationTreeMapper.fromUntrustedJSON` (Zod validation
 *     per node + TreeNode construction) + `new PinnedManager(tree)`.
 *     This mirrors what the sidepanel used to do before fix A.
 *
 *   • NEW path: `buildTreeIndex(treeJSON)` — single DFS, no Zod, no
 *     TreeNode allocation. Replaces both old steps in one pass.
 *
 * Run with `pnpm bench:sidepanel-cold-load`.
 *
 * The benchmark is local to verifying the rewrite. It is NOT in the
 * default `pnpm test` script because it depends on Node's timing
 * resolution (perf-tier sensitive), and a CI machine may produce noisy
 * numbers without invalidating the architectural win.
 */
import { NavigationTreeMapper } from "../src/shared/lib/mapper.js";
import { PinnedManager } from "../src/background/state/pinned.js";
import { buildTreeIndex } from "../src/apps/sidepanel/ui/state/tree-index.js";
import {
  asNodeId,
  now,
  type NodeId,
  type Timestamp,
  type Title,
  type Url,
} from "../src/shared/types/ids.js";
import type { NavigationNodeJSON } from "../src/shared/types/node.js";
import type { NavigationTreeJSON } from "../src/shared/types/tree.js";

let nextId = 0;
function id(): NodeId {
  nextId += 1;
  return asNodeId(`b${nextId}`);
}

function buildSyntheticTree(targetSize: number): NavigationTreeJSON {
  // Branching factor 3 gives a realistic-ish tree shape (not a chain,
  // not a star). Depth grows ~log3(targetSize).
  const root: NavigationNodeJSON = {
    id: id(),
    timestamp: now() as Timestamp,
    data: {
      url: "chrome://newtab/" as Url,
      title: "New Tab" as Title,
      pinned: false,
      tags: [],
    },
    children: [],
  };

  const queue: NavigationNodeJSON[] = [root];
  let count = 1;
  while (count < targetSize) {
    const parent = queue.shift();
    if (!parent) break;
    for (let i = 0; i < 3 && count < targetSize; i += 1) {
      const child: NavigationNodeJSON = {
        id: id(),
        timestamp: now() as Timestamp,
        data: {
          url: `https://example.com/page${count}` as Url,
          title: `Page ${count}` as Title,
          pinned: count % 50 === 0,
          tags: [],
          visitCount: (count % 10) + 1,
          lastVisitedAt: now() as Timestamp,
        },
        children: [],
      };
      parent.children.push(child);
      queue.push(child);
      count += 1;
    }
  }

  return { root, currentNodeId: root.id, nodeCount: count };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx]!;
}

function bench(label: string, runs: number, fn: () => void): { med: number; p95: number } {
  // Warmup
  for (let i = 0; i < 3; i += 1) fn();
  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  const med = median(samples);
  const ninetyfive = p95(samples);
  console.log(
    `  ${label.padEnd(45)} median=${med.toFixed(2)}ms  p95=${ninetyfive.toFixed(2)}ms`,
  );
  return { med, p95: ninetyfive };
}

function run(): void {
  const TARGET = 5000;
  const RUNS = 10;

  console.log(`Building synthetic tree (target ${TARGET} nodes)...`);
  const json = buildSyntheticTree(TARGET);
  console.log(`  actual nodeCount=${json.nodeCount}`);
  console.log("");
  console.log(`Benchmark: ${RUNS} runs after 3 warmup, median + p95.`);
  console.log("");

  console.log("--- Sidepanel-side path (fix A) ---");
  const oldSidepanel = bench("OLD: fromUntrustedJSON + new PinnedManager", RUNS, () => {
    const tree = NavigationTreeMapper.fromUntrustedJSON(json);
    new PinnedManager(tree);
  });
  const newSidepanel = bench("NEW: buildTreeIndex", RUNS, () => {
    buildTreeIndex(json);
  });
  console.log(
    `  Sidepanel speedup: ${(oldSidepanel.med / newSidepanel.med).toFixed(2)}x median, ${(
      oldSidepanel.p95 / newSidepanel.p95
    ).toFixed(2)}x p95`,
  );

  console.log("");
  console.log("--- SW-side path (fix B) ---");
  const swUntrusted = bench("BEFORE: fromJSON (Zod per node + TreeNode)", RUNS, () => {
    NavigationTreeMapper.fromUntrustedJSON(json);
  });
  const swTrusted = bench("AFTER:  fromTrustedJSON (TreeNode only)", RUNS, () => {
    NavigationTreeMapper.fromTrustedJSON(json);
  });
  console.log(
    `  SW speedup: ${(swUntrusted.med / swTrusted.med).toFixed(2)}x median, ${(
      swUntrusted.p95 / swTrusted.p95
    ).toFixed(2)}x p95`,
  );
}

run();
