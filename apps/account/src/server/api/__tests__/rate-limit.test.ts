import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit } from "@/src/server/api/rate-limit";
import type { RateLimitTier } from "@/src/server/api/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    // Reset module state by clearing the internal windows map via exhaustion
    // We use unique keys per test to avoid cross-test contamination
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const key = "test-under-limit";
    const result = rateLimit(key, "default");
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(59); // 60 - 1
  });

  it("returns correct headers", () => {
    const key = "test-headers";
    const result = rateLimit(key, "default");
    expect(result.headers["X-RateLimit-Limit"]).toBe("60");
    expect(result.headers["X-RateLimit-Remaining"]).toBe("59");
  });

  it("decrements remaining on successive calls", () => {
    const key = "test-decrement";
    rateLimit(key, "default");
    const second = rateLimit(key, "default");
    expect(second.ok).toBe(true);
    expect(second.remaining).toBe(58); // 60 - 2

    const third = rateLimit(key, "default");
    expect(third.remaining).toBe(57);
  });

  it("blocks after limit is exceeded", () => {
    const key = "test-block";
    // Exhaust the default limit of 60
    for (let i = 0; i < 60; i++) {
      const r = rateLimit(key, "default");
      expect(r.ok).toBe(true);
    }
    // 61st request should be blocked
    const blocked = rateLimit(key, "default");
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window expires", () => {
    const key = "test-reset";
    // Exhaust the limit
    for (let i = 0; i < 61; i++) {
      rateLimit(key, "default");
    }
    const blocked = rateLimit(key, "default");
    expect(blocked.ok).toBe(false);

    // Advance time past the 60s window
    vi.advanceTimersByTime(61_000);

    const after = rateLimit(key, "default");
    expect(after.ok).toBe(true);
    expect(after.remaining).toBe(59);
  });

  it("uses default tier when none specified", () => {
    const key = "test-default-tier";
    const result = rateLimit(key);
    expect(result.ok).toBe(true);
    expect(result.headers["X-RateLimit-Limit"]).toBe("60");
  });

  it("auth tier has lower limit of 10", () => {
    const key = "test-auth-tier";
    for (let i = 0; i < 10; i++) {
      const r = rateLimit(key, "auth");
      expect(r.ok).toBe(true);
    }
    const blocked = rateLimit(key, "auth");
    expect(blocked.ok).toBe(false);
    expect(blocked.headers["X-RateLimit-Limit"]).toBe("10");
  });

  it("sync tier has higher limit of 120", () => {
    const key = "test-sync-tier";
    const result = rateLimit(key, "sync");
    expect(result.ok).toBe(true);
    expect(result.headers["X-RateLimit-Limit"]).toBe("120");
    expect(result.remaining).toBe(119);
  });

  it("webhook tier has limit of 30", () => {
    const key = "test-webhook-tier";
    const result = rateLimit(key, "webhook");
    expect(result.headers["X-RateLimit-Limit"]).toBe("30");
    expect(result.remaining).toBe(29);
  });

  it("public tier has limit of 120", () => {
    const key = "test-public-tier";
    const result = rateLimit(key, "public");
    expect(result.headers["X-RateLimit-Limit"]).toBe("120");
    expect(result.remaining).toBe(119);
  });

  it("different keys are independent", () => {
    const keyA = "test-independent-a";
    const keyB = "test-independent-b";

    // Exhaust key A
    for (let i = 0; i < 61; i++) {
      rateLimit(keyA, "auth");
    }
    expect(rateLimit(keyA, "auth").ok).toBe(false);

    // Key B should still work
    expect(rateLimit(keyB, "auth").ok).toBe(true);
  });
});
