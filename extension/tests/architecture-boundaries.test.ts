import assert from 'node:assert/strict';
import { fromCompact, toCompact } from '../src/shared/lib/compact-mapper.js';
import type { CompactTreeJSONV1 } from '../src/shared/types/compact-tree.js';
import type { NavigationTreeJSON } from '../src/shared/types/tree.js';
import { resolveFlags } from '../src/shared/types/flags.js';

function run(): void {
  const tree: NavigationTreeJSON = {
    root: {
      id: 1 as never,
      timestamp: 1_000 as never,
      data: {
        url: 'https://example.com' as never,
        title: 'Example' as never,
        pinned: false,
        tags: [],
        lastVisitedAt: 2_000 as never,
      },
      children: [],
    },
    currentNodeId: 1 as never,
    nodeCount: 1,
  };

  const compact = toCompact(tree);
  assert.equal(compact.v, 3, 'encoder should write compact v3');
  const roundTrip = fromCompact(compact);
  assert.equal(
    roundTrip.root?.data.lastVisitedAt,
    2_000 as never,
    'v3 round-trip should preserve lastVisitedAt',
  );

  const legacyV1: CompactTreeJSONV1 = {
    v: 1,
    r: [
      1,
      1_000,
      'https://legacy.example',
      'Legacy',
      null,
      0,
      [],
      null,
      [],
    ],
    c: 1,
    n: 1,
  };

  const legacyDecoded = fromCompact(legacyV1);
  assert.equal(legacyDecoded.root?.data.title, 'Legacy' as never);
  assert.equal(
    legacyDecoded.root?.data.lastVisitedAt,
    undefined,
    'v1 decode should work without lastVisitedAt',
  );

  const legacyOnly = resolveFlags({ spotlightRecencyV2: true });
  assert.equal(
    legacyOnly.recencyOrderingV2,
    false,
    'legacy spotlight flag key must be ignored without migration',
  );

  const v2On = resolveFlags({ recencyOrderingV2: true });
  assert.equal(v2On.recencyOrderingV2, true, 'recencyOrderingV2 should enable v2 ordering');
}

run();
console.log('architecture-boundaries.test.ts passed');
