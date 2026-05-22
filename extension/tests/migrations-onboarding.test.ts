/**
 * v3→v4 `drop_onboarding_orphans` migration — pure helper coverage.
 *
 * The migration runner itself depends on `wxt/utils/storage`, which is
 * a virtual module not available in this `node --import tsx` harness
 * (same constraint as `migrations.test.ts`). The interesting behaviour
 * — pruning orphan keys + idempotency — lives in the pure helper, so
 * we test that directly. The runner wiring is covered by source-text
 * assertions in `migrations.test.ts`.
 */
import assert from "node:assert/strict";
import {
  cleanOnboardingState,
  hasOnboardingOrphans,
} from "../src/background/services/migrations-onboarding.js";

// The six fields removed in commit 7e118e8e ("remove interactive
// onboarding tour, simplify to wizard-only flow"). These must be
// dropped by the migration. If a future commit re-introduces any of
// them, this test will fail and force a deliberate decision.
const ORPHAN_KEYS = [
  "tourStep",
  "tourTreeId",
  "tourFirstResultChildId",
  "tourBranchParentId",
  "priorActiveTreeId",
  "softCtaDismissed",
] as const;

const CURRENT_KEYS = [
  "seenWelcome",
  "completedAt",
  "step",
  "phase",
  "wizardStep",
  "persona",
  "startedAt",
] as const;

// ---------------------------------------------------------------------------
// 1. hasOnboardingOrphans — detector for the skip-write fast-path
// ---------------------------------------------------------------------------

assert.equal(
  hasOnboardingOrphans(null),
  false,
  "hasOnboardingOrphans(null) must be false — no keys, no orphans.",
);
assert.equal(
  hasOnboardingOrphans(undefined),
  false,
  "hasOnboardingOrphans(undefined) must be false.",
);
assert.equal(
  hasOnboardingOrphans({}),
  false,
  "hasOnboardingOrphans({}) must be false — empty has no orphans.",
);
assert.equal(
  hasOnboardingOrphans({ seenWelcome: true, completedAt: null, step: 0 }),
  false,
  "hasOnboardingOrphans must return false on already-clean state.",
);
assert.equal(
  hasOnboardingOrphans({ seenWelcome: true, tourStep: 2 }),
  true,
  "hasOnboardingOrphans must return true when any orphan key is present.",
);

// ---------------------------------------------------------------------------
// 2. cleanOnboardingState — pruning + value preservation
// ---------------------------------------------------------------------------

// Full legacy shape — every orphan field populated alongside the
// current ones. Models a user mid-tour at the moment commit 7e118e8e
// shipped, who then closed the sidepanel and never reopened it.
const legacy = {
  seenWelcome: true,
  completedAt: 1_700_000_000_000,
  step: 5,
  phase: "tour",
  wizardStep: 3,
  persona: "research",
  startedAt: 1_699_999_000_000,
  // Orphans:
  tourStep: 2,
  tourTreeId: "tour-tree-uuid",
  tourFirstResultChildId: "child-uuid",
  tourBranchParentId: "branch-uuid",
  priorActiveTreeId: "prior-tree-uuid",
  softCtaDismissed: { signin: true, pin: false },
};

const cleaned = cleanOnboardingState(legacy);

// Every orphan key must be gone.
for (const orphan of ORPHAN_KEYS) {
  assert.ok(
    !Object.prototype.hasOwnProperty.call(cleaned, orphan),
    `cleaned state still carries orphan key '${orphan}'.`,
  );
}

// Every current key must be present and equal to the input.
for (const key of CURRENT_KEYS) {
  assert.deepEqual(
    (cleaned as Record<string, unknown>)[key],
    (legacy as Record<string, unknown>)[key],
    `cleaned state lost or mutated current key '${key}'.`,
  );
}

// Input must not be mutated (the helper returns a fresh object).
for (const orphan of ORPHAN_KEYS) {
  assert.ok(
    Object.prototype.hasOwnProperty.call(legacy, orphan),
    `cleanOnboardingState mutated input — orphan '${orphan}' was removed in-place.`,
  );
}

// ---------------------------------------------------------------------------
// 3. Idempotency — running twice is a no-op
// ---------------------------------------------------------------------------

const twice = cleanOnboardingState(cleaned);
assert.deepEqual(
  twice,
  cleaned,
  "cleanOnboardingState is not idempotent — second pass differs from first.",
);
assert.equal(
  hasOnboardingOrphans(cleaned),
  false,
  "cleaned state must register as orphan-free for the skip-write fast-path.",
);

// ---------------------------------------------------------------------------
// 4. Fresh-install / initial-state no-op
// ---------------------------------------------------------------------------

const fresh = {
  seenWelcome: false,
  completedAt: null,
  step: 0,
  phase: null,
  wizardStep: 0,
  persona: null,
  startedAt: null,
};
assert.deepEqual(
  cleanOnboardingState(fresh),
  fresh,
  "cleanOnboardingState must be a no-op on the canonical initial state.",
);

// ---------------------------------------------------------------------------
// 5. Defensive — non-object input
// ---------------------------------------------------------------------------

const fromNull = cleanOnboardingState(null);
assert.equal(typeof fromNull, "object", "cleanOnboardingState(null) must return an object.");
assert.equal(
  fromNull.seenWelcome,
  false,
  "cleanOnboardingState(null) must return canonical default.",
);

const fromUndef = cleanOnboardingState(undefined);
assert.equal(
  fromUndef.seenWelcome,
  false,
  "cleanOnboardingState(undefined) must return canonical default.",
);

const fromString = cleanOnboardingState("corrupted-entry");
assert.equal(
  fromString.seenWelcome,
  false,
  "cleanOnboardingState on non-object input must return canonical default.",
);

// ---------------------------------------------------------------------------
// 6. Migration-style end-to-end — simulates the runner's read→clean→write
//    cycle and asserts the second pass is a no-op (skip-write fast-path).
// ---------------------------------------------------------------------------

// "Storage" stub holds a single value, like onboardingStateItem.
let storage: unknown = legacy;

function runMigrationOnce(): { wrote: boolean } {
  if (!hasOnboardingOrphans(storage)) return { wrote: false };
  storage = cleanOnboardingState(storage);
  return { wrote: true };
}

const first = runMigrationOnce();
assert.equal(first.wrote, true, "first migration pass must rewrite legacy storage.");

const second = runMigrationOnce();
assert.equal(
  second.wrote,
  false,
  "second migration pass must be a no-op (no orphan keys remain).",
);

for (const orphan of ORPHAN_KEYS) {
  assert.ok(
    !Object.prototype.hasOwnProperty.call(storage, orphan),
    `after migration, storage still carries orphan key '${orphan}'.`,
  );
}

console.log("migrations-onboarding.test.ts: ok");
