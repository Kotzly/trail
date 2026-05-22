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
 * Contract (post-refactor): the list of items to clear is declared in
 * `USER_SCOPED_STORAGE_ITEMS` in `storage-items.ts`. This test reads
 * that file textually (we can't load the WXT `storage.defineItem`
 * runtime under `node --import tsx`) and asserts:
 *
 *   1. Every required bucket label appears in the registry.
 *   2. `wipe.ts` iterates the registry (rather than re-hardcoding a list).
 *   3. `wipe.ts` calls `safeRun` so a single failing reset cannot abort
 *      the rest of the wipe.
 *   4. `runUserChangeWipeIfNeeded` short-circuits on same-user sign-in
 *      and guards the wipe behind a `previousUserId` check so the
 *      first-sign-in path doesn't wipe pre-existing local trees.
 *   5. `lastSignedInUserIdItem` is always advanced (otherwise next
 *      sign-in would re-wipe).
 *
 * If you intentionally drop or rename a bucket, update REQUIRED_WIPE_LABELS
 * in the same commit with a justification.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const STORAGE_ITEMS_SRC = readFileSync(
  resolve(here, "../src/shared/config/storage-items.ts"),
  "utf8",
);
const WIPE_SRC = readFileSync(
  resolve(here, "../src/shared/auth/orchestrator/wipe.ts"),
  "utf8",
);

// ---------------------------------------------------------------------------
// Locate registry body in storage-items.ts and wipe body in wipe.ts
// ---------------------------------------------------------------------------

function extractArrayBody(src: string, declName: string): string {
  // Match: export const NAME ... = [ ... ];  (single-pass bracket-depth walk)
  const start = new RegExp(
    `export\\s+const\\s+${declName}\\s*:[^=]*=\\s*\\[`,
  ).exec(src);
  assert.ok(start, `array constant ${declName} not found`);
  const startIdx = start.index + start[0].length;
  let depth = 1;
  let i = startIdx;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    i++;
  }
  return src.slice(startIdx, i - 1);
}

function extractFunctionBody(src: string, name: string): string {
  const startMatch = new RegExp(
    `(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*:\\s*[^{]+\\{`,
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

const registryBody = extractArrayBody(STORAGE_ITEMS_SRC, "USER_SCOPED_STORAGE_ITEMS");
const wipeBody = extractFunctionBody(WIPE_SRC, "wipeUserScopedLocalState");
const userChangeBody = extractFunctionBody(WIPE_SRC, "runUserChangeWipeIfNeeded");

// ---------------------------------------------------------------------------
// 1. Every required bucket is registered with the right reset target
// ---------------------------------------------------------------------------

type Wipe = {
  label: string;
  // Substrings that must all be present in the SAME entry of the registry.
  matchers: string[];
};

const REQUIRED_WIPES: Wipe[] = [
  { label: "syncState", matchers: ["syncStateItem.setValue"] },
  { label: "pendingSyncOps", matchers: ["pendingSyncOpsItem.setValue"] },
  { label: "localDeleteTombstones", matchers: ["localDeleteTombstonesItem.setValue"] },
  { label: "cleanupTombstones", matchers: ["cleanupTombstonesItem.setValue"] },
  { label: "openTabs", matchers: ["openTabsItem.setValue"] },
  { label: "undoHistory", matchers: ["undoHistoryItem.setValue"] },
  { label: "conflictPicks", matchers: ["conflictPicksItem.setValue"] },
  { label: "layoutPositions", matchers: ["layoutPositionsCacheItem.setValue"] },
  { label: "pendingShareImport", matchers: ["pendingShareImportItem.setValue"] },
  // deviceId rotation: critical — without it the new user's first sync
  // tries to claim the previous owner's device row.
  { label: "deviceId", matchers: ["deviceIdItem.setValue(null)"] },
];

// Split the registry into entry blocks at each `label:` so we can match
// label + reset target within one entry.
const entries = registryBody
  .split(/(?=\{\s*label:)/)
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0);

for (const wipe of REQUIRED_WIPES) {
  const entry = entries.find((e) => e.includes(`label: "${wipe.label}"`));
  assert.ok(
    entry,
    `USER_SCOPED_STORAGE_ITEMS must register bucket "${wipe.label}". Either add it to the registry or update REQUIRED_WIPES with a justification.`,
  );
  for (const matcher of wipe.matchers) {
    assert.ok(
      entry.includes(matcher),
      `USER_SCOPED_STORAGE_ITEMS entry for "${wipe.label}" must call "${matcher}" — found:\n${entry}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 2. The wipe iterates the registry rather than re-hardcoding the list
// ---------------------------------------------------------------------------

assert.ok(
  /for\s*\(\s*const\s+\w+\s+of\s+USER_SCOPED_STORAGE_ITEMS\s*\)/.test(wipeBody),
  "wipeUserScopedLocalState must iterate USER_SCOPED_STORAGE_ITEMS — found body:\n" + wipeBody,
);

// Per-tree blobs use dynamic keys (no defineItem registration), so the
// wipe must still call the explicit treeStorage clear.
assert.ok(
  /treeStorage\.clearAllTrees/.test(wipeBody),
  "wipeUserScopedLocalState must still call treeStorage.clearAllTrees() — per-tree blobs aren't in the registry.",
);

// ---------------------------------------------------------------------------
// 3. Every clear (registry iteration + explicit calls) is wrapped in safeRun
// ---------------------------------------------------------------------------

const safeRunCount = (wipeBody.match(/safeRun\(/g) ?? []).length;
assert.ok(
  safeRunCount >= 2,
  `wipeUserScopedLocalState must wrap each reset in safeRun(...) so a thrown error doesn't skip subsequent wipes — found ${safeRunCount} occurrence(s).`,
);
// The trees clear MUST be on its own safeRun line.
assert.ok(
  /safeRun\([^)]*"trees"[^)]*,\s*\(\)\s*=>\s*treeStorage\.clearAllTrees\(\)\)/.test(wipeBody),
  "treeStorage.clearAllTrees must be wrapped in safeRun.",
);
// The registry loop body MUST call safeRun.
assert.ok(
  /for\s*\([\s\S]*?of\s+USER_SCOPED_STORAGE_ITEMS\s*\)\s*\{[\s\S]*?safeRun\(/.test(wipeBody),
  "the registry iteration must call safeRun for each item.",
);

// ---------------------------------------------------------------------------
// 4. runUserChangeWipeIfNeeded calls wipeUserScopedLocalState only on
//    user-change, never on first sign-in (preserves local trees on
//    onboarding — see lessons.md 2026-04-27).
// ---------------------------------------------------------------------------

assert.ok(
  /previousUserId\s*===\s*identity\.userId/.test(userChangeBody),
  "runUserChangeWipeIfNeeded must short-circuit when previousUserId matches identity.userId (no-op for same-user sign-in).",
);

assert.ok(
  /if\s*\(\s*previousUserId\s*\)\s*\{[\s\S]*wipeUserScopedLocalState\(\)/.test(userChangeBody),
  "runUserChangeWipeIfNeeded must guard wipe behind `if (previousUserId)` — first sign-in (previousUserId === null) must NOT wipe pre-existing local state.",
);

assert.ok(
  /lastSignedInUserIdItem\.setValue\(identity\.userId\)/.test(userChangeBody),
  "runUserChangeWipeIfNeeded must always advance lastSignedInUserIdItem (otherwise next sign-in would re-wipe).",
);

console.log(
  `auth-wipe-coverage: OK — ${REQUIRED_WIPES.length} buckets registered, wipe iterates registry, all safeRun-wrapped, gating logic intact`,
);
