// In-memory sliding window rate limiter.
// TODO: replace with @upstash/ratelimit + Redis for Vercel production.

const windows = new Map<string, { count: number; resetAt: number }>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) windows.delete(key);
  }
}

export type RateLimitTier = "default" | "auth" | "sync" | "webhook" | "public";

const TIER_LIMITS: Record<RateLimitTier, { limit: number; windowMs: number }> = {
  default: { limit: 60, windowMs: 60_000 },
  auth: { limit: 10, windowMs: 60_000 },
  sync: { limit: 120, windowMs: 60_000 },
  webhook: { limit: 30, windowMs: 60_000 },
  public: { limit: 120, windowMs: 60_000 },
};

export function rateLimit(
  key: string,
  tier: RateLimitTier = "default",
): { ok: boolean; remaining: number; headers: Record<string, string> } {
  cleanup();
  const opts = TIER_LIMITS[tier];
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + opts.windowMs });
    return {
      ok: true,
      remaining: opts.limit - 1,
      headers: {
        "X-RateLimit-Limit": String(opts.limit),
        "X-RateLimit-Remaining": String(opts.limit - 1),
      },
    };
  }

  entry.count++;
  const remaining = Math.max(0, opts.limit - entry.count);
  const headers = {
    "X-RateLimit-Limit": String(opts.limit),
    "X-RateLimit-Remaining": String(remaining),
  };

  if (entry.count > opts.limit) {
    return { ok: false, remaining: 0, headers };
  }
  return { ok: true, remaining, headers };
}
