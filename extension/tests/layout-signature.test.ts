import assert from 'node:assert/strict';
import { computeLayoutSignature, computeCollapseSignature } from '../src/shared/graph-layout-cache/types.js';

// ---------------------------------------------------------------------------
// computeLayoutSignature — deterministic string from layout params
// ---------------------------------------------------------------------------

function testDeterministicSignature(): void {
  const params = {
    mode: 'tree',
    density: 'comfortable',
    tree: { verticalGapScale: 1, horizontalGapScale: 1 },
    mindmap: { verticalGapScale: 1, horizontalGapScale: 1 },
    radial: {
      angleWeightExp: 0.42,
      minSpanFactor: 0.75,
      minSpanAbs: 0.11,
      requiredScale: 0.85,
      depthGapBase: 2.2,
      depthGapGrowth: 0.08,
    },
    collapseSignature: '',
    recencyOrdering: false,
  };

  const sig1 = computeLayoutSignature(params);
  const sig2 = computeLayoutSignature(params);

  assert.equal(typeof sig1, 'string', 'should return a string');
  assert.ok(sig1.length > 0, 'should not be empty');
  assert.equal(sig1, sig2, 'same inputs should produce same string');
}

function testDifferentModeProducesDifferentSignature(): void {
  const base = {
    mode: 'tree',
    density: 'comfortable',
    tree: { verticalGapScale: 1, horizontalGapScale: 1 },
    mindmap: { verticalGapScale: 1, horizontalGapScale: 1 },
    radial: {
      angleWeightExp: 0.42,
      minSpanFactor: 0.75,
      minSpanAbs: 0.11,
      requiredScale: 0.85,
      depthGapBase: 2.2,
      depthGapGrowth: 0.08,
    },
    collapseSignature: '',
    recencyOrdering: false,
  };

  const sigTree = computeLayoutSignature(base);
  const sigRadial = computeLayoutSignature({ ...base, mode: 'radial' });

  assert.notEqual(sigTree, sigRadial, 'different mode should produce different signature');
}

function testDifferentDensityProducesDifferentSignature(): void {
  const base = {
    mode: 'tree',
    density: 'comfortable',
    tree: { verticalGapScale: 1, horizontalGapScale: 1 },
    mindmap: { verticalGapScale: 1, horizontalGapScale: 1 },
    radial: {
      angleWeightExp: 0.42,
      minSpanFactor: 0.75,
      minSpanAbs: 0.11,
      requiredScale: 0.85,
      depthGapBase: 2.2,
      depthGapGrowth: 0.08,
    },
    collapseSignature: '',
    recencyOrdering: false,
  };

  const sigComfortable = computeLayoutSignature(base);
  const sigCompact = computeLayoutSignature({ ...base, density: 'compact' });

  assert.notEqual(sigComfortable, sigCompact, 'different density should produce different signature');
}

function testDifferentCollapseSignatureProducesDifferentSignature(): void {
  const base = {
    mode: 'tree',
    density: 'comfortable',
    tree: { verticalGapScale: 1, horizontalGapScale: 1 },
    mindmap: { verticalGapScale: 1, horizontalGapScale: 1 },
    radial: {
      angleWeightExp: 0.42,
      minSpanFactor: 0.75,
      minSpanAbs: 0.11,
      requiredScale: 0.85,
      depthGapBase: 2.2,
      depthGapGrowth: 0.08,
    },
    collapseSignature: '',
    recencyOrdering: false,
  };

  const sigEmpty = computeLayoutSignature(base);
  const sigCollapsed = computeLayoutSignature({ ...base, collapseSignature: '1,2,3' });

  assert.notEqual(sigEmpty, sigCollapsed, 'different collapse signature should produce different signature');
}

function testDifferentRecencyOrderingProducesDifferentSignature(): void {
  const base = {
    mode: 'tree',
    density: 'comfortable',
    tree: { verticalGapScale: 1, horizontalGapScale: 1 },
    mindmap: { verticalGapScale: 1, horizontalGapScale: 1 },
    radial: {
      angleWeightExp: 0.42,
      minSpanFactor: 0.75,
      minSpanAbs: 0.11,
      requiredScale: 0.85,
      depthGapBase: 2.2,
      depthGapGrowth: 0.08,
    },
    collapseSignature: '',
    recencyOrdering: false,
  };

  const sigNoRecency = computeLayoutSignature(base);
  const sigRecency = computeLayoutSignature({ ...base, recencyOrdering: true });

  assert.notEqual(sigNoRecency, sigRecency, 'different recencyOrdering should produce different signature');
}

function testSignatureContainsExpectedFormat(): void {
  const params = {
    mode: 'tree',
    density: 'comfortable',
    tree: { verticalGapScale: 1, horizontalGapScale: 1 },
    mindmap: { verticalGapScale: 1, horizontalGapScale: 1 },
    radial: {
      angleWeightExp: 0.42,
      minSpanFactor: 0.75,
      minSpanAbs: 0.11,
      requiredScale: 0.85,
      depthGapBase: 2.2,
      depthGapGrowth: 0.08,
    },
    collapseSignature: '',
    recencyOrdering: false,
  };

  const sig = computeLayoutSignature(params);

  // Verify it contains key components
  assert.ok(sig.includes('tree'), 'should contain mode');
  assert.ok(sig.includes('comfortable'), 'should contain density');
  assert.ok(sig.includes('0'), 'should contain recency flag');
}

// ---------------------------------------------------------------------------
// Run all tests
// ---------------------------------------------------------------------------

const tests = [
  ['deterministic signature', testDeterministicSignature],
  ['different mode produces different signature', testDifferentModeProducesDifferentSignature],
  ['different density produces different signature', testDifferentDensityProducesDifferentSignature],
  ['different collapse signature produces different signature', testDifferentCollapseSignatureProducesDifferentSignature],
  ['different recency ordering produces different signature', testDifferentRecencyOrderingProducesDifferentSignature],
  ['signature contains expected format', testSignatureContainsExpectedFormat],
] as const;

let passed = 0;
let failed = 0;

for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL: ${name}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

console.log(`\nLayout signature tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
