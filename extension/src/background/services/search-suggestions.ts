const CACHE_TTL_MS = 30_000;
const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 5;
const GOOGLE_SUGGEST_URL = "https://www.google.com/complete/search?client=chrome&q=";

type CacheEntry = {
  readonly suggestions: readonly string[];
  readonly timestamp: number;
};

const cache = new Map<string, CacheEntry>();

function pruneStaleEntries(now: number): void {
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

function getCached(query: string, now: number): readonly string[] | null {
  const entry = cache.get(query);
  if (!entry) return null;
  if (now - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(query);
    return null;
  }
  return entry.suggestions;
}

export async function fetchSearchSuggestions(query: string): Promise<readonly string[]> {
  if (query.length < MIN_QUERY_LENGTH) return [];

  const now = Date.now();
  const cached = getCached(query, now);
  if (cached) return cached;

  try {
    const response = await fetch(`${GOOGLE_SUGGEST_URL}${encodeURIComponent(query)}`);
    if (!response.ok) return [];

    const data: unknown = await response.json();
    if (!Array.isArray(data) || !Array.isArray(data[1])) return [];

    const raw: unknown[] = data[1];
    const suggestions = raw
      .filter((item): item is string => typeof item === "string")
      .slice(0, MAX_SUGGESTIONS);

    cache.set(query, { suggestions, timestamp: now });

    if (cache.size > 100) {
      pruneStaleEntries(now);
    }

    return suggestions;
  } catch (e) {
    console.warn("[search-suggestions] Fetch failed:", String(e));
    return [];
  }
}
