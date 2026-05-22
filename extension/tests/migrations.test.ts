/**
 * Migration registry guard + 0.9.1 → 1.0.x re-mint smoke test.
 *
 * The migration runner itself depends on `wxt/utils/storage`, which is
 * a virtual module not available in this `node --import tsx` harness.
 * So we verify two things:
 *
 *   1. The MIGRATIONS array is structurally correct — every step from 0
 *      to CURRENT_SCHEMA_VERSION has an entry, and the v2→v3 cleanup
 *      removes the legacy 0.9.x keys we expect.
 *
 *   2. The `rementIdsInTreeJSON` transform — which is the only
 *      behavior-affecting step on the 0.9.1 → 1.0.x path — correctly
 *      rewrites a tree whose `currentNodeId` is the legacy `number`
 *      shape, mapping it to the new uuidv7 of the same logical node.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { rementIdsInTreeJSON } from "../src/background/services/migrations-rement.js";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(here, "../src/background/services/migrations.ts"),
  "utf8",
);

// ---------------------------------------------------------------------------
// 1. Structural — registry covers every step and cleans legacy keys
// ---------------------------------------------------------------------------

// Source-text verification (avoids importing wxt/utils/storage at test time).
const versionMatch = /CURRENT_SCHEMA_VERSION\s*=\s*(\d+)/.exec(SRC);
if (!versionMatch) {
  throw new Error("Could not locate CURRENT_SCHEMA_VERSION literal in migrations.ts");
}
const currentSchemaVersion = Number(versionMatch[1]);
assert.equal(
  currentSchemaVersion,
  4,
  "CURRENT_SCHEMA_VERSION drifted — update the registry coverage check below in the same commit.",
);

// Each entry must show up as a `from: N, to: N+1` literal in the source.
// Regex tolerates whitespace + any trailing keys on the same line.
const expectedSteps = Array.from({ length: currentSchemaVersion }, (_, i) => ({
  from: i,
  to: i + 1,
}));
for (const step of expectedSteps) {
  const re = new RegExp(`from:\\s*${step.from}\\s*,\\s*to:\\s*${step.to}\\b`);
  assert.ok(
    re.test(SRC),
    `MIGRATIONS missing step from: ${step.from} to: ${step.to}. Either add it or lower CURRENT_SCHEMA_VERSION.`,
  );
}

// The 0.9.x cleanup migration must remove both legacy chrome.storage.local
// keys identified during the Supabase cutover. If you rename or drop one
// of these, update LEGACY_LOCAL_KEYS and this test together.
assert.ok(
  /trail_auth_session/.test(SRC),
  "cleanup_legacy_keys must reference 'trail_auth_session' (the 0.9.x BetterAuth JWT slot).",
);
assert.ok(
  /trail_v3_sync/.test(SRC),
  "cleanup_legacy_keys must reference 'trail_v3_sync' (the 0.9.x sync-engine cursor).",
);

// The v3→v4 onboarding-orphan cleanup must be registered by name so
// the runner picks it up after the legacy-keys step. Behavioural
// coverage lives in migrations-onboarding.test.ts (pure helper).
assert.ok(
  /name:\s*"drop_onboarding_orphans"/.test(SRC),
  "MIGRATIONS must contain a step named 'drop_onboarding_orphans' (v3→v4 cleanup of tour-era OnboardingState fields).",
);

// ---------------------------------------------------------------------------
// 2. Behavioral — re-mint transforms a 0.9.1-shaped tree correctly
// ---------------------------------------------------------------------------

// 0.9.1's NavigationNodeJSON used numeric ids for every node and a
// numeric `currentNodeId`. The v1→v2 migration must replace each id
// with a fresh uuidv7 string and rewrite `currentNodeId` to point at
// the *new* id of the same logical node (lookup via the internal map).
type LegacyNode = {
  id: number;
  timestamp: number;
  data: { url: string; title: string; pinned: boolean; tags: string[] };
  children: LegacyNode[];
};

const legacyTree = {
  root: {
    id: 1,
    timestamp: 1000,
    data: { url: "about:blank", title: "root", pinned: false, tags: [] },
    children: [
      {
        id: 2,
        timestamp: 1100,
        data: { url: "https://a.example", title: "a", pinned: false, tags: [] },
        children: [
          {
            id: 4,
            timestamp: 1200,
            data: { url: "https://a.b.example", title: "ab", pinned: false, tags: [] },
            children: [],
          },
        ],
      },
      {
        id: 3,
        timestamp: 1100,
        data: { url: "https://c.example", title: "c", pinned: false, tags: [] },
        children: [],
      },
    ],
  } satisfies LegacyNode,
  currentNodeId: 4 as number | string | null,
  nodeCount: 4,
};

// The transform is in-place (matches production runtime).
rementIdsInTreeJSON(legacyTree);

const uuidv7Re =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function walk(node: unknown, visit: (n: { id: unknown }) => void): void {
  if (!node || typeof node !== "object") return;
  const n = node as { id?: unknown; children?: unknown[] };
  visit(n as { id: unknown });
  if (Array.isArray(n.children)) for (const c of n.children) walk(c, visit);
}

// Every node id must now be a uuidv7 string.
walk(legacyTree.root, (n) => {
  assert.equal(typeof n.id, "string", `node id must be string after re-mint, got ${typeof n.id}`);
  assert.match(
    n.id as string,
    uuidv7Re,
    `node id ${String(n.id)} is not a uuidv7 — re-mint regressed.`,
  );
});

// `currentNodeId` was numeric `4`, pointing at the deepest leaf. After
// re-mint it must equal the leaf's *new* uuidv7, not the previous
// numeric value and not null.
assert.equal(
  typeof legacyTree.currentNodeId,
  "string",
  "currentNodeId must follow the leaf into uuidv7-space.",
);
const leafNewId = (legacyTree.root.children[0]?.children[0] as { id: unknown } | undefined)?.id;
assert.equal(
  legacyTree.currentNodeId,
  leafNewId,
  "currentNodeId must map to the leaf's new uuidv7 via the internal idMap.",
);

// Idempotency: running it again on already-uuidv7 data is harmless
// (re-mints to *new* uuidv7s but stays well-formed). This guards
// against accidental introduction of non-string id branches.
rementIdsInTreeJSON(legacyTree);
walk(legacyTree.root, (n) => {
  assert.match(n.id as string, uuidv7Re, "second re-mint produced a non-uuidv7 id.");
});

console.log("migrations.test.ts: ok");
