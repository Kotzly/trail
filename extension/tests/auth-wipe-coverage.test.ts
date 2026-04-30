/**
 * Per-user wipe coverage guard (B8.1).
 *
 * `runUserChangeWipeIfNeeded` is the only line of defence against
 * cross-account data leakage on a shared browser: when the signed-in
 * userId changes, every per-user storage bucket must be cleared before
 * the new identity broadcasts `signed-in`. A regression that drops one
 * of these clears means the next user inherits the previous user's
 * trees, sync metadata, queued cloud ops, or — worst — their device id
 * (which silently fails the `devices` RLS USING check and leaves an
 * orphan).
 *
 * The wipe is glued to WXT's `storage.defineItem` API, which makes it
 * awkward to exercise inside our `node --import tsx` harness. So
 * instead we treat `wipeUserScopedLocalState` as a contract: this test
 * reads the source and asserts every required bucket is cleared and
 * each call is wrapped in `safeRun` so a single failing bucket cannot
 * abort the rest. If you intentionally drop or rename a bucket, update
 * the REQUIRED list below in the same commit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(here, "../src/shared/auth/auth-orchestrator.ts"),
  "utf8",
);

// ---------------------------------------------------------------------------
// Locate wipeUserScopedLocalState body
// ---------------------------------------------------------------------------

function extractFunctionBody(src: string, name: string): string {
  // Match: async function NAME(...): T { ... } — handles nested braces.
  const startMatch = new RegExp(
    `async function ${name}\\s*\\([^)]*\\)\\s*:\\s*[^{]+\\{`,
  ).exec(src);
  assert.ok(startMatch, `function ${name} not found`);
  const startIdx = startMatch.index + startMatch[0].length;
  let depth = 1;
  let i = startIdx;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  return src.slice(startIdx, i - 1);
}

const wipeBody = extractFunctionBody(SRC, "wipeUserScopedLocalState");

// ---------------------------------------------------------------------------
// 1. Every required per-user bucket is cleared
// ---------------------------------------------------------------------------

type Wipe = {
  label: string;
  // Substrings that must all be present in the same line of wipeBody.
  matchers: string[];
};

const REQUIRED_WIPES: Wipe[] = [
  { label: "trees", matchers: ["treeStorage.clearAllTrees"] },
  { label: "syncState", matchers: ["syncStateItem.setValue"] },
  { label: "pendingSyncOps", matchers: ["pendingSyncOpsItem.setValue"] },
  {
    label: "localDeleteTombstones",
    matchers: ["localDeleteTombstonesItem.setValue"],
  },
  { label: "cleanupTombstones", matchers: ["cleanupTombstonesItem.setValue"] },
  { label: "openTabs", matchers: ["openTabsItem.setValue"] },
  { label: "undoHistory", matchers: ["undoHistoryItem.setValue"] },
  { label: "conflictPicks", matchers: ["conflictPicksItem.setValue"] },
  {
    label: "layoutPositions",
    matchers: ["layoutPositionsCacheItem.setValue"],
  },
  // deviceId rotation: critical — without it the new user's first sync
  // tries to claim the previous owner's device row.
  { label: "deviceId", matchers: ["deviceIdItem.setValue(null)"] },
];

for (const wipe of REQUIRED_WIPES) {
  for (const matcher of wipe.matchers) {
    assert.ok(
      wipeBody.includes(matcher),
      `wipeUserScopedLocalState must clear "${wipe.label}" — missing reference to "${matcher}". Either add the wipe or update REQUIRED_WIPES with a justification.`,
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Every clear is wrapped in safeRun (so a single failing bucket does
//    not abort the rest of the wipe)
// ---------------------------------------------------------------------------

const lines = wipeBody.split("\n");
for (const wipe of REQUIRED_WIPES) {
  const idx = lines.findIndex((line) => line.includes(wipe.matchers[0]));
  assert.ok(idx >= 0, `bucket "${wipe.label}" not found while checking safeRun wrap`);
  // Walk back up at most a few lines to find safeRun on the same call.
  let found = false;
  for (let i = idx; i >= Math.max(0, idx - 3); i--) {
    if (lines[i].includes("safeRun(")) {
      found = true;
      break;
    }
  }
  assert.ok(
    found,
    `bucket "${wipe.label}" must be wrapped in safeRun(...) so a thrown error doesn't skip subsequent wipes. Found bare call near "${lines[idx].trim()}".`,
  );
}

// ---------------------------------------------------------------------------
// 3. runUserChangeWipeIfNeeded calls wipeUserScopedLocalState only on
//    user-change, never on first sign-in (preserves local trees on
//    onboarding — see lessons.md 2026-04-27).
// ---------------------------------------------------------------------------

const orchestratorBody = extractFunctionBody(SRC, "runUserChangeWipeIfNeeded");

assert.ok(
  /previousUserId\s*===\s*identity\.userId/.test(orchestratorBody),
  "runUserChangeWipeIfNeeded must short-circuit when previousUserId matches identity.userId (no-op for same-user sign-in).",
);

assert.ok(
  /if\s*\(\s*previousUserId\s*\)\s*\{[\s\S]*wipeUserScopedLocalState\(\)/.test(
    orchestratorBody,
  ),
  "runUserChangeWipeIfNeeded must guard wipe behind `if (previousUserId)` — first sign-in (previousUserId === null) must NOT wipe pre-existing local state.",
);

assert.ok(
  /lastSignedInUserIdItem\.setValue\(identity\.userId\)/.test(orchestratorBody),
  "runUserChangeWipeIfNeeded must always advance lastSignedInUserIdItem (otherwise next sign-in would re-wipe).",
);

console.log(
  `auth-wipe-coverage: OK — ${REQUIRED_WIPES.length} buckets covered, all wrapped in safeRun, gating logic intact`,
);
