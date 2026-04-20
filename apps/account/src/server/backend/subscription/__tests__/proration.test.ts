import { describe, it, expect } from "vitest";
import {
  isUpgrade,
  proratedUpgradeChargeCents,
  requirePaidPlan,
} from "../proration";
import type { PlanDefinition } from "@/src/server/backend/account-snapshot";

const pro: PlanDefinition = {
  id: "pro",
  name: "Pro",
  priceMonthly: 9,
  priceYearly: 90,
  currency: "USD",
} as PlanDefinition;

const teams: PlanDefinition = {
  id: "teams",
  name: "Teams",
  priceMonthly: 29,
  priceYearly: 290,
  currency: "USD",
} as PlanDefinition;

describe("isUpgrade", () => {
  it.each([
    ["free", "pro", true],
    ["free", "teams", true],
    ["pro", "teams", true],
    ["pro", "pro", false],
    ["teams", "pro", false],
    ["teams", "free", false],
  ])("isUpgrade(%s → %s) === %s", (from, to, expected) => {
    expect(isUpgrade(from as never, to as never)).toBe(expected);
  });
});

describe("requirePaidPlan", () => {
  it("passes for paid plans", () => {
    expect(() => requirePaidPlan("pro")).not.toThrow();
    expect(() => requirePaidPlan("teams")).not.toThrow();
  });

  it("throws for free or invalid", () => {
    expect(() => requirePaidPlan("free")).toThrow();
    expect(() => requirePaidPlan("nonsense")).toThrow();
  });
});

describe("proratedUpgradeChargeCents", () => {
  it("zero charge when remaining time is zero (now === periodEnd)", () => {
    const now = new Date("2026-04-01T00:00:00Z");
    const result = proratedUpgradeChargeCents({
      now,
      currentPeriodStart: new Date("2026-03-01T00:00:00Z"),
      currentPeriodEnd: now,
      fromPlan: pro,
      toPlan: teams,
      interval: "month",
    });
    expect(result.chargeCents).toBe(0);
    expect(result.creditCents).toBe(0);
    expect(result.remainingRatio).toBe(0);
  });

  it("full charge when now === periodStart (100% of period remains)", () => {
    const periodStart = new Date("2026-04-01T00:00:00Z");
    const periodEnd = new Date("2026-05-01T00:00:00Z");
    const result = proratedUpgradeChargeCents({
      now: periodStart,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      fromPlan: pro,
      toPlan: teams,
      interval: "month",
    });
    expect(result.remainingRatio).toBe(1);
    // credit = 900 * 1 = 900; proratedNew = 2900 * 1 = 2900;
    // charge = 2900 - 900 = 2000.
    expect(result.creditCents).toBe(900);
    expect(result.chargeCents).toBe(2000);
  });

  it("half charge at mid-period", () => {
    const periodStart = new Date("2026-04-01T00:00:00Z");
    const periodEnd = new Date("2026-05-01T00:00:00Z");
    const midway = new Date("2026-04-16T00:00:00Z"); // 50% mark
    const result = proratedUpgradeChargeCents({
      now: midway,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      fromPlan: pro,
      toPlan: teams,
      interval: "month",
    });
    expect(result.remainingRatio).toBeCloseTo(0.5, 2);
    // Mid-period: credit ≈ 450, proratedNew ≈ 1450, charge ≈ 1000.
    expect(result.chargeCents).toBeGreaterThan(950);
    expect(result.chargeCents).toBeLessThan(1050);
  });

  it("annual interval uses yearly price", () => {
    const periodStart = new Date("2026-01-01T00:00:00Z");
    const periodEnd = new Date("2027-01-01T00:00:00Z");
    const result = proratedUpgradeChargeCents({
      now: periodStart,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      fromPlan: pro,
      toPlan: teams,
      interval: "year",
    });
    // credit = 9000 * 1 = 9000; proratedNew = 29000; charge = 20000.
    expect(result.creditCents).toBe(9000);
    expect(result.chargeCents).toBe(20000);
  });

  it("clamps negative remaining (now past periodEnd) to 0", () => {
    const result = proratedUpgradeChargeCents({
      now: new Date("2026-06-01T00:00:00Z"),
      currentPeriodStart: new Date("2026-04-01T00:00:00Z"),
      currentPeriodEnd: new Date("2026-05-01T00:00:00Z"),
      fromPlan: pro,
      toPlan: teams,
      interval: "month",
    });
    expect(result.remainingRatio).toBe(0);
    expect(result.chargeCents).toBe(0);
  });
});
