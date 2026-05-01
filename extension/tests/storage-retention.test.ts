import { strict as assert } from "node:assert";
import { describe, it, beforeEach } from "node:test";
import type { TreeIndexEntry, TreeSummary, TreeStub } from "../src/shared/types/tree.js";
import {
  maybeReclaimStorage,
  runReclaimSweep,
  setRetentionDeps,
  resetRetentionState,
  type RetentionDeps,
} from "../src/background/services/storage-retention.js";

// ── Helpers ────────────────────────────────────────────────────────

const QUOTA = 10 * 1024 * 1024;
const ABOVE_HIGH = Math.floor(0.8 * QUOTA);
const BELOW_HIGH = Math.floor(0.5 * QUOTA);
const BELOW_LOW = Math.floor(0.55 * QUOTA);

function summary(id: string, lastOpenedAt: number, savedAt = lastOpenedAt): TreeSummary {
  return {
    id,
    label: id,
    labelSource: "user",
    labelUpdatedAt: 0,
    createdAt: 0,
    nodeCount: 1,
    savedAt,
    lastOpenedAt,
  };
}

function stub(id: string, lastOpenedAt: number): TreeStub {
  return { ...summary(id, lastOpenedAt), stub: true as const };
}

type Recorder = {
  pushed: string[];
  deleted: string[];
  stubbed: string[];
  notified: number;
  bytesProbes: number;
};

type Setup = {
  rec: Recorder;
  state: {
    bytes: number;
    signedIn: boolean;
    activeId: string;
    index: TreeIndexEntry[];
    pushOutcome: (treeId: string) => string;
    pushDelay?: number;
  };
};

function setup(overrides?: Partial<Setup["state"]>): Setup {
  const rec: Recorder = { pushed: [], deleted: [], stubbed: [], notified: 0, bytesProbes: 0 };
  const state: Setup["state"] = {
    bytes: ABOVE_HIGH,
    signedIn: true,
    activeId: "active",
    index: [],
    pushOutcome: () => "ok",
    ...overrides,
  };
  const deps: RetentionDeps = {
    getBytesInUse: async () => {
      rec.bytesProbes++;
      return state.bytes;
    },
    isSignedIn: () => state.signedIn,
    getActiveId: async () => state.activeId,
    getIndex: async () => state.index,
    pushTree: async (id) => {
      rec.pushed.push(id);
      if (state.pushDelay) await new Promise((r) => setTimeout(r, state.pushDelay));
      return state.pushOutcome(id);
    },
    deleteBlob: async (id) => {
      rec.deleted.push(id);
    },
    stubEntry: async (id) => {
      rec.stubbed.push(id);
    },
    notifyUpdate: async () => {
      rec.notified++;
    },
    now: () => Date.now(),
  };
  setRetentionDeps(deps);
  resetRetentionState();
  return { rec, state };
}

// ── Tests ──────────────────────────────────────────────────────────

describe("storage-retention", () => {
  beforeEach(() => {
    setRetentionDeps(null);
    resetRetentionState();
  });

  describe("maybeReclaimStorage probe", () => {
    it("skips when usage below high-water", async () => {
      const { rec, state } = setup({ bytes: BELOW_HIGH });
      state.index = [summary("t1", 100)];

      maybeReclaimStorage();
      await new Promise((r) => setTimeout(r, 0));

      assert.equal(rec.bytesProbes, 1);
      assert.deepEqual(rec.pushed, []);
      assert.deepEqual(rec.stubbed, []);
    });

    it("skips when signed-out without probing quota", async () => {
      const { rec } = setup({ signedIn: false });
      maybeReclaimStorage();
      await new Promise((r) => setTimeout(r, 0));

      assert.equal(rec.bytesProbes, 0);
      assert.deepEqual(rec.stubbed, []);
    });

    it("triggers sweep when above high-water and signed-in", async () => {
      const { rec, state } = setup({ bytes: ABOVE_HIGH });
      state.index = [summary("only", 100)];

      maybeReclaimStorage();
      // probe is fire-and-forget — drain the microtask queue.
      await new Promise((r) => setTimeout(r, 0));

      assert.deepEqual(rec.pushed, ["only"]);
      assert.deepEqual(rec.stubbed, ["only"]);
    });

    it("throttles repeat probes within window", async () => {
      const { rec, state } = setup({ bytes: ABOVE_HIGH });
      state.index = [summary("t1", 100)];

      maybeReclaimStorage();
      await new Promise((r) => setTimeout(r, 0));
      const probesAfterFirst = rec.bytesProbes;

      // simulate a second storage write within throttle window
      maybeReclaimStorage();
      await new Promise((r) => setTimeout(r, 0));

      // Second call should NOT have called getBytesInUse a second time at probe-stage.
      // (sweep itself probes after each stub — so ≥ probesAfterFirst always; equal means no
      // re-probe at the maybeReclaim entry point.)
      assert.equal(rec.bytesProbes, probesAfterFirst);
    });
  });

  describe("runReclaimSweep candidate selection", () => {
    it("returns no-candidates when index is empty", async () => {
      setup();
      const result = await runReclaimSweep();
      assert.equal(result.reason, "no-candidates");
      assert.deepEqual(result.stubbed, []);
    });

    it("excludes the active tree even if it is the oldest", async () => {
      const { rec, state } = setup({ bytes: ABOVE_HIGH, activeId: "active" });
      state.index = [summary("active", 1), summary("other", 100)];

      await runReclaimSweep();

      assert.deepEqual(rec.stubbed, ["other"]);
      assert.ok(!rec.stubbed.includes("active"));
    });

    it("excludes existing stubs", async () => {
      const { rec, state } = setup({ bytes: ABOVE_HIGH });
      state.index = [stub("already-stub", 1), summary("real", 100)];

      await runReclaimSweep();

      assert.deepEqual(rec.stubbed, ["real"]);
    });

    it("sorts candidates by lastOpenedAt ascending", async () => {
      const { rec, state } = setup({ bytes: ABOVE_HIGH });
      state.index = [
        summary("middle", 200),
        summary("oldest", 100),
        summary("newest", 300),
      ];

      await runReclaimSweep();

      assert.deepEqual(rec.stubbed, ["oldest", "middle", "newest"]);
    });

    it("falls back to savedAt when lastOpenedAt is missing", async () => {
      const { rec, state } = setup({ bytes: ABOVE_HIGH });
      const noOpened: TreeSummary = {
        id: "no-opened",
        label: "x",
        labelSource: "user",
        labelUpdatedAt: 0,
        createdAt: 0,
        nodeCount: 1,
        savedAt: 50,
      };
      state.index = [summary("with-opened", 200), noOpened];

      await runReclaimSweep();

      // savedAt=50 is older than lastOpenedAt=200 → no-opened first
      assert.equal(rec.stubbed[0], "no-opened");
    });
  });

  describe("runReclaimSweep stubbing logic", () => {
    it("calls deleteBlob then stubEntry on push success", async () => {
      const { rec, state } = setup({ bytes: ABOVE_HIGH });
      state.index = [summary("t1", 100)];
      const calls: string[] = [];
      setRetentionDeps({
        getBytesInUse: async () => state.bytes,
        isSignedIn: () => state.signedIn,
        getActiveId: async () => state.activeId,
        getIndex: async () => state.index,
        pushTree: async () => "ok",
        deleteBlob: async () => {
          calls.push("delete");
        },
        stubEntry: async () => {
          calls.push("stub");
        },
        notifyUpdate: async () => {
          rec.notified++;
        },
        now: () => Date.now(),
      });

      await runReclaimSweep();

      assert.deepEqual(calls, ["delete", "stub"]);
      assert.equal(rec.notified, 1);
    });

    it("skips trees with non-ok push outcomes", async () => {
      const outcomes = ["conflict", "offline", "rate_limited", "skipped", "error"];
      for (const outcome of outcomes) {
        const { rec, state } = setup({ bytes: ABOVE_HIGH, pushOutcome: () => outcome });
        state.index = [summary("t1", 100)];
        await runReclaimSweep();
        assert.deepEqual(rec.stubbed, [], `should not stub on outcome=${outcome}`);
        assert.deepEqual(rec.deleted, [], `should not delete on outcome=${outcome}`);
      }
    });

    it("continues past skipped candidates to the next eligible tree", async () => {
      const { rec, state } = setup({
        bytes: ABOVE_HIGH,
        pushOutcome: (id) => (id === "blocked" ? "conflict" : "ok"),
      });
      state.index = [summary("blocked", 100), summary("ok-tree", 200)];

      await runReclaimSweep();

      assert.deepEqual(rec.stubbed, ["ok-tree"]);
    });

    it("stops once usage drops below low-water", async () => {
      const { rec, state } = setup({ bytes: ABOVE_HIGH });
      state.index = [summary("a", 100), summary("b", 200), summary("c", 300)];

      // After stubbing one tree, usage drops below LOW_WATER.
      let stubCount = 0;
      setRetentionDeps({
        getBytesInUse: async () => (stubCount === 0 ? ABOVE_HIGH : BELOW_LOW),
        isSignedIn: () => true,
        getActiveId: async () => "active",
        getIndex: async () => state.index,
        pushTree: async (id) => {
          rec.pushed.push(id);
          return "ok";
        },
        deleteBlob: async () => {},
        stubEntry: async (id) => {
          rec.stubbed.push(id);
          stubCount++;
        },
        notifyUpdate: async () => {},
        now: () => Date.now(),
      });

      const result = await runReclaimSweep();

      assert.deepEqual(rec.stubbed, ["a"]);
      assert.equal(result.reason, "below-low-water");
    });

    it("respects MAX_STUBS_PER_SWEEP cap", async () => {
      const { rec, state } = setup({ bytes: ABOVE_HIGH });
      // 15 candidates, cap is 10
      state.index = Array.from({ length: 15 }, (_, i) => summary(`t${i}`, i));

      const result = await runReclaimSweep();

      assert.equal(rec.stubbed.length, 10);
      assert.equal(result.reason, "max-stubs");
    });

    it("does not call notifyUpdate when nothing was stubbed", async () => {
      const { rec, state } = setup({
        bytes: ABOVE_HIGH,
        pushOutcome: () => "conflict",
      });
      state.index = [summary("t1", 100)];

      await runReclaimSweep();

      assert.equal(rec.notified, 0);
    });

    it("returns signed-out without probing when not authenticated", async () => {
      const { rec } = setup({ signedIn: false });
      const result = await runReclaimSweep();
      assert.equal(result.reason, "signed-out");
      assert.deepEqual(rec.stubbed, []);
    });
  });

  describe("re-entry guard", () => {
    it("serializes parallel runReclaimSweep invocations", async () => {
      const { rec, state } = setup({ bytes: ABOVE_HIGH, pushDelay: 20 });
      state.index = [summary("t1", 100), summary("t2", 200)];

      // Each sweep would normally process all 2 trees. If serialized
      // correctly, two parallel calls produce 4 stub events total in
      // strict order without overlapping (the second sweep will find
      // already-stubbed trees... but our mock doesn't update the
      // index, so for this test we just verify ordering: first sweep
      // completes before second sweep starts pushing).
      const order: string[] = [];
      setRetentionDeps({
        getBytesInUse: async () => state.bytes,
        isSignedIn: () => true,
        getActiveId: async () => state.activeId,
        getIndex: async () => state.index,
        pushTree: async (id) => {
          order.push(`push-start:${id}`);
          await new Promise((r) => setTimeout(r, 10));
          order.push(`push-end:${id}`);
          return "ok";
        },
        deleteBlob: async () => {},
        stubEntry: async (id) => {
          rec.stubbed.push(id);
        },
        notifyUpdate: async () => {},
        now: () => Date.now(),
      });

      await Promise.all([runReclaimSweep(), runReclaimSweep()]);

      // The two sweeps must not interleave: every push-start is
      // immediately followed by its matching push-end before the
      // next push-start. (This is a strict sequencing check.)
      for (let i = 0; i < order.length; i += 2) {
        const start = order[i]!;
        const end = order[i + 1]!;
        assert.ok(start.startsWith("push-start:"), `expected push-start at ${i}, got ${start}`);
        assert.ok(end.startsWith("push-end:"), `expected push-end at ${i + 1}, got ${end}`);
        assert.equal(start.slice("push-start:".length), end.slice("push-end:".length));
      }
    });
  });
});
