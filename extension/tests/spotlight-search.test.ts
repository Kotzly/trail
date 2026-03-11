import assert from 'node:assert/strict';
import {
  parseSpotlightQuery,
  resolveSpotlightQueryMode,
  tokenizeSpotlightQuery,
} from '../src/shared/lib/spotlight/query-dsl.js';
import { scoreSpotlightCandidate } from '../src/shared/lib/spotlight/scoring.js';
import {
  emptySpotlightUsageStats,
  recordSpotlightSelection,
  getSelectionFrequencyBoost,
  getSelectionTokenAffinityBoost,
} from '../src/shared/lib/spotlight/usage-stats.js';
import {
  normalizeSpotlightSearchQuery,
  normalizeSpotlightUrlCandidate,
} from '../src/shared/lib/spotlight/external.js';
import type { NodeId } from '../src/shared/types/ids.js';

function testDslAndOr(): void {
  const ast = parseSpotlightQuery('foo bar | baz');
  assert.equal(ast.clauses.length, 2, 'must parse OR clauses');
  assert.deepEqual(
    ast.clauses[0]?.terms.map((t) => t.value),
    ['foo', 'bar'],
    'first clause should keep AND terms',
  );
  assert.deepEqual(ast.clauses[1]?.terms.map((t) => t.value), ['baz']);
  console.log('  dsl and/or: OK');
}

function testDslPhraseNegationFields(): void {
  const tokens = tokenizeSpotlightQuery('"foo bar" -baz domain:github.com tab:open tree:current group:open-tabs is:current');
  const values = tokens.filter((t) => t.raw !== '|');
  assert.equal(values[0]?.exact, true, 'phrase should be exact');
  assert.equal(values[0]?.value, 'foo bar');
  assert.equal(values[1]?.negated, true, 'negation should be parsed');
  assert.equal(values[2]?.field, 'domain');
  assert.equal(values[3]?.field, 'tab');
  assert.equal(values[4]?.field, 'tree');
  assert.equal(values[5]?.field, 'group');
  assert.equal(values[6]?.field, 'is');
  console.log('  dsl phrase/neg/fields: OK');
}

function testDslInvalidFallback(): void {
  const tokens = tokenizeSpotlightQuery('tab:invalid tree:bad nope:field');
  assert.equal(tokens[0]?.field, undefined, 'invalid tab value must fallback to literal');
  assert.equal(tokens[1]?.field, undefined, 'invalid tree value must fallback to literal');
  assert.equal(tokens[2]?.field, undefined, 'unknown field must fallback to literal');
  console.log('  dsl invalid fallback: OK');
}

function testCommandModeParsing(): void {
  const command = resolveSpotlightQueryMode('> export tree');
  assert.equal(command.mode, 'commands');
  assert.equal(command.normalizedQuery, 'export tree');

  const search = resolveSpotlightQueryMode('github issues');
  assert.equal(search.mode, 'search');

  const discover = resolveSpotlightQueryMode('   ');
  assert.equal(discover.mode, 'discover');
  console.log('  dsl command mode: OK');
}

function testScoringOrdering(): void {
  const now = Date.now();

  const exact = scoreSpotlightCandidate(
    {
      nodeId: 1 as NodeId,
      title: 'Repo issues',
      url: 'https://github.com/org/repo',
      domain: 'github.com',
      group: 'open-tabs',
      recency: now,
      isCurrent: false,
      tabCount: 2,
      exactPrefixMatch: true,
      graphProximityBoost: 3,
      branchAffinityBoost: 1.2,
      selectionFrequencyBoost: 1.4,
      selectionTokenAffinityBoost: 1.2,
    },
    {
      textScore: 7,
      queryDomains: ['github.com'],
      queryUrls: ['https://github.com/org/repo'],
    },
    now,
  );

  const weak = scoreSpotlightCandidate(
    {
      nodeId: 2 as NodeId,
      title: 'Example',
      url: 'https://example.com/page',
      domain: 'example.com',
      group: 'recently-closed',
      recency: now - 7 * 24 * 60 * 60 * 1000,
      isCurrent: false,
      tabCount: 0,
    },
    {
      textScore: 2,
      queryDomains: ['github.com'],
      queryUrls: ['https://github.com/org/repo'],
    },
    now,
  );

  assert(exact.finalScore > weak.finalScore, 'exact hit with boosts should outrank weak hit');

  const penalizedCurrent = scoreSpotlightCandidate(
    {
      nodeId: 3 as NodeId,
      title: 'Repo issues',
      url: 'https://github.com/org/repo',
      domain: 'github.com',
      group: 'open-tabs',
      recency: now,
      isCurrent: true,
      tabCount: 2,
      exactPrefixMatch: true,
      graphProximityBoost: 3,
      branchAffinityBoost: 1.2,
    },
    {
      textScore: 7,
      queryDomains: ['github.com'],
      queryUrls: ['https://github.com/org/repo'],
    },
    now,
  );

  assert(
    penalizedCurrent.finalScore < exact.finalScore,
    'isCurrent items should receive penalty',
  );

  console.log('  scoring ordering: OK');
}

function testUsageStatsBoosts(): void {
  let stats = emptySpotlightUsageStats();
  stats = recordSpotlightSelection(stats, 'n:tree-1:1', ['github', 'issues'], Date.now());
  stats = recordSpotlightSelection(stats, 'n:tree-1:1', ['github'], Date.now());

  const entry = stats.targets['n:tree-1:1'];
  assert(entry, 'recorded entry should exist');
  assert(getSelectionFrequencyBoost(entry) > 1, 'frequency boost should grow with repeated picks');
  assert(getSelectionTokenAffinityBoost(entry, ['github']) > 0, 'token affinity should use matching query token');
  console.log('  usage stats boosts: OK');
}

function testExternalFallbackParsing(): void {
  assert.equal(
    normalizeSpotlightSearchQuery('   github issues   '),
    'github issues',
    'search query should trim surrounding whitespace',
  );
  assert.equal(
    normalizeSpotlightUrlCandidate('trail.app/docs'),
    'https://trail.app/docs',
    'bare host should normalize to https URL',
  );
  assert.equal(
    normalizeSpotlightUrlCandidate('https://trail.app/docs?q=1'),
    'https://trail.app/docs?q=1',
    'full URL should be preserved',
  );
  assert.equal(
    normalizeSpotlightUrlCandidate('github issues'),
    null,
    'plain search text should not be treated as URL',
  );
  console.log('  external fallback parsing: OK');
}

function run(): void {
  console.log('Running spotlight-search.test.ts...');
  testDslAndOr();
  testDslPhraseNegationFields();
  testDslInvalidFallback();
  testCommandModeParsing();
  testScoringOrdering();
  testUsageStatsBoosts();
  testExternalFallbackParsing();
}

run();
console.log('spotlight-search.test.ts: ALL PASSED');
