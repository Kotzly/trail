export type SpotlightUsageStats = {
  version: 1;
  targets: Record<string, SpotlightUsageTargetStats>;
  recentQueries?: string[];
};

export type SpotlightUsageTargetStats = {
  count: number;
  lastSelectedAt: number;
  tokenCounts: Record<string, number>;
};

const MAX_TARGETS = 500;
const MAX_TOKENS_PER_TARGET = 20;
const MAX_QUERY_TOKENS = 5;
const STALE_TARGET_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export function emptySpotlightUsageStats(): SpotlightUsageStats {
  return {
    version: 1,
    targets: {},
  };
}

export function sanitizeSpotlightUsageStats(input: SpotlightUsageStats | null | undefined): SpotlightUsageStats {
  if (!input || input.version !== 1 || typeof input.targets !== 'object') {
    return emptySpotlightUsageStats();
  }

  const targets: Record<string, SpotlightUsageTargetStats> = {};
  for (const [key, value] of Object.entries(input.targets)) {
    if (!value || typeof value !== 'object') continue;
    const count = Number((value as SpotlightUsageTargetStats).count);
    const lastSelectedAt = Number((value as SpotlightUsageTargetStats).lastSelectedAt);
    const tokenCounts = sanitizeTokenCounts((value as SpotlightUsageTargetStats).tokenCounts);
    if (!Number.isFinite(count) || count <= 0) continue;
    if (!Number.isFinite(lastSelectedAt) || lastSelectedAt <= 0) continue;
    targets[key] = {
      count,
      lastSelectedAt,
      tokenCounts,
    };
  }

  const result: SpotlightUsageStats = {
    version: 1,
    targets,
  };

  if (Array.isArray(input.recentQueries)) {
    result.recentQueries = input.recentQueries.filter((q) => typeof q === 'string').slice(0, MAX_RECENT_QUERIES);
  }

  return pruneSpotlightUsageStats(result, Date.now());
}

export function normalizeUsageQueryTokens(tokens: string[]): string[] {
  const unique = new Set<string>();
  for (const token of tokens) {
    const normalized = token.trim().toLowerCase();
    if (normalized.length < 2) continue;
    unique.add(normalized);
    if (unique.size >= MAX_QUERY_TOKENS) break;
  }
  return [...unique];
}

export function recordSpotlightSelection(
  stats: SpotlightUsageStats,
  targetKey: string,
  queryTokens: string[],
  now: number,
): SpotlightUsageStats {
  const next = sanitizeSpotlightUsageStats(stats);
  const entry = next.targets[targetKey] ?? {
    count: 0,
    lastSelectedAt: now,
    tokenCounts: {},
  };

  entry.count += 1;
  entry.lastSelectedAt = now;

  for (const token of normalizeUsageQueryTokens(queryTokens)) {
    entry.tokenCounts[token] = (entry.tokenCounts[token] ?? 0) + 1;
  }

  entry.tokenCounts = sanitizeTokenCounts(entry.tokenCounts);
  next.targets[targetKey] = entry;
  return pruneSpotlightUsageStats(next, now);
}

export function getSelectionFrequencyBoost(entry: SpotlightUsageTargetStats | null | undefined): number {
  if (!entry) return 0;
  return Math.min(Math.log2(1 + Math.max(entry.count, 0)), 2);
}

export function getSelectionTokenAffinityBoost(
  entry: SpotlightUsageTargetStats | null | undefined,
  queryTokens: string[],
): number {
  if (!entry) return 0;
  const normalized = normalizeUsageQueryTokens(queryTokens);
  if (normalized.length === 0) return 0;

  let total = 0;
  for (const token of normalized) {
    const count = entry.tokenCounts[token] ?? 0;
    if (count <= 0) continue;
    total += Math.min(0.55, Math.log2(1 + count) * 0.24);
  }
  return Math.min(total, 1.5);
}

export function pruneSpotlightUsageStats(stats: SpotlightUsageStats, now: number): SpotlightUsageStats {
  const cleaned = emptySpotlightUsageStats();
  const entries = Object.entries(stats.targets)
    .filter(([, value]) => now - value.lastSelectedAt <= STALE_TARGET_AGE_MS)
    .sort((a, b) => b[1].lastSelectedAt - a[1].lastSelectedAt || b[1].count - a[1].count)
    .slice(0, MAX_TARGETS);

  for (const [key, value] of entries) {
    cleaned.targets[key] = {
      count: value.count,
      lastSelectedAt: value.lastSelectedAt,
      tokenCounts: sanitizeTokenCounts(value.tokenCounts),
    };
  }

  if (stats.recentQueries) {
    cleaned.recentQueries = stats.recentQueries;
  }

  return cleaned;
}

const MAX_RECENT_QUERIES = 10;

export function recordRecentQuery(stats: SpotlightUsageStats, query: string): SpotlightUsageStats {
  const trimmed = query.trim();
  if (!trimmed || trimmed.startsWith('>') || trimmed.startsWith('/')) return stats;
  const filtered = (stats.recentQueries ?? []).filter((q) => q !== trimmed);
  return {
    ...stats,
    recentQueries: [trimmed, ...filtered].slice(0, MAX_RECENT_QUERIES),
  };
}

export function getRecentQueries(stats: SpotlightUsageStats): string[] {
  return (stats.recentQueries ?? []).slice(0, MAX_RECENT_QUERIES);
}

export function getTopTargetKeys(stats: SpotlightUsageStats, limit: number): string[] {
  return Object.entries(stats.targets)
    .sort((a, b) => b[1].count - a[1].count || b[1].lastSelectedAt - a[1].lastSelectedAt)
    .slice(0, limit)
    .map(([key]) => key);
}

function sanitizeTokenCounts(input: Record<string, number> | null | undefined): Record<string, number> {
  const normalized = Object.entries(input ?? {})
    .map(([key, value]) => [key.trim().toLowerCase(), Number(value)] as const)
    .filter(([key, value]) => key.length >= 2 && Number.isFinite(value) && value > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_TOKENS_PER_TARGET);

  return Object.fromEntries(normalized);
}
