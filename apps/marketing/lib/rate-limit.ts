import "server-only";

/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Limitations:
 * - Resets on cold start (serverless function recycled)
 * - Not shared across instances
 *
 * For production-grade rate limiting on Vercel, replace with
 * @upstash/ratelimit backed by Upstash Redis.
 */

type RateLimiterConfig = {
  windowMs: number;
  maxRequests: number;
};

type RateLimiter = {
  isLimited: (key: string) => boolean;
};

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const hits = new Map<string, number[]>();

  // Periodically clean stale entries to prevent memory leaks
  const CLEANUP_INTERVAL_MS = 60_000;
  let lastCleanup = Date.now();

  function cleanup(now: number) {
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;
    for (const [key, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => now - t < config.windowMs);
      if (valid.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, valid);
      }
    }
  }

  return {
    isLimited(key: string): boolean {
      const now = Date.now();
      cleanup(now);

      const timestamps = (hits.get(key) ?? []).filter(
        (t) => now - t < config.windowMs,
      );
      if (timestamps.length >= config.maxRequests) {
        hits.set(key, timestamps);
        return true;
      }
      timestamps.push(now);
      hits.set(key, timestamps);
      return false;
    },
  };
}
