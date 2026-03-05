import type { NodeId } from '@shared/types/ids.js';
import type { SpotlightSuggestionGroup } from '@shared/rpc/contracts.js';

const RECENCY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const RECENCY_MAX = 2.5;
const OPEN_TAB_BOOST = 2.0;
const TAB_COUNT_MULTIPLIER = 0.6;
const CURRENT_TREE_BOOST = 0.8;
const EXACT_DOMAIN_BOOST = 1.2;
const EXACT_URL_BOOST = 1.5;
const CURRENT_NODE_PENALTY = -1.5;

export type SpotlightScoringCandidate = {
  nodeId: NodeId;
  url: string;
  domain: string;
  group: SpotlightSuggestionGroup;
  recency: number;
  isCurrent: boolean;
  tabCount: number;
};

export type SpotlightScoreContext = {
  textScore: number;
  queryDomains: string[];
  queryUrls: string[];
};

export type SpotlightScoreBreakdown = {
  finalScore: number;
  textScore: number;
  recencyScore: number;
  openTabBoost: number;
  tabCountBoost: number;
  currentTreeBoost: number;
  exactDomainBoost: number;
  exactUrlBoost: number;
  currentNodePenalty: number;
};

export function scoreSpotlightCandidate(
  candidate: SpotlightScoringCandidate,
  query: SpotlightScoreContext,
  now: number,
): SpotlightScoreBreakdown {
  const textScore = normalizeTextScore(query.textScore);
  const recencyScore = computeRecencyScore(candidate.recency, now);
  const openTabBoost = candidate.group === 'open-tabs' ? OPEN_TAB_BOOST : 0;
  const tabCountBoost = Math.min(Math.log2(1 + Math.max(candidate.tabCount, 0)), 3) * TAB_COUNT_MULTIPLIER;
  const currentTreeBoost = candidate.group === 'current-tree' ? CURRENT_TREE_BOOST : 0;
  const exactDomainBoost = hasDomainBoost(candidate.domain, query.queryDomains) ? EXACT_DOMAIN_BOOST : 0;
  const exactUrlBoost = hasUrlBoost(candidate.url, query.queryUrls) ? EXACT_URL_BOOST : 0;
  const currentNodePenalty = candidate.isCurrent ? CURRENT_NODE_PENALTY : 0;

  const finalScore =
    textScore +
    recencyScore +
    openTabBoost +
    tabCountBoost +
    currentTreeBoost +
    exactDomainBoost +
    exactUrlBoost +
    currentNodePenalty;

  return {
    finalScore,
    textScore,
    recencyScore,
    openTabBoost,
    tabCountBoost,
    currentTreeBoost,
    exactDomainBoost,
    exactUrlBoost,
    currentNodePenalty,
  };
}

function normalizeTextScore(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.max(0, Math.min(8, raw));
}

function computeRecencyScore(recency: number, now: number): number {
  if (!Number.isFinite(recency) || recency <= 0) return 0;
  const age = Math.max(0, now - recency);
  if (age >= RECENCY_WINDOW_MS) return 0;
  const weight = 1 - age / RECENCY_WINDOW_MS;
  return weight * RECENCY_MAX;
}

function hasDomainBoost(domain: string, queryDomains: string[]): boolean {
  const normalized = domain.toLowerCase();
  for (const target of queryDomains) {
    const q = target.toLowerCase();
    if (!q) continue;
    if (normalized === q || normalized.endsWith(`.${q}`)) {
      return true;
    }
  }
  return false;
}

function hasUrlBoost(url: string, queryUrls: string[]): boolean {
  const normalized = normalizeUrl(url);
  for (const candidate of queryUrls) {
    if (normalizeUrl(candidate) === normalized) {
      return true;
    }
  }
  return false;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    const searchParams = new URLSearchParams(parsed.search);
    const keys = Array.from(searchParams.keys()).sort();
    const normalizedSearch = new URLSearchParams();
    for (const key of keys) {
      const values = searchParams.getAll(key).sort();
      for (const value of values) {
        normalizedSearch.append(key, value);
      }
    }
    parsed.search = normalizedSearch.toString() ? `?${normalizedSearch.toString()}` : '';
    return parsed.toString();
  } catch {
    return url;
  }
}
