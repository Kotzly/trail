import { describe, it, expect } from "vitest";
import {
  addUtcMonths,
  addUtcYears,
  addInterval,
  toApiInterval,
  toDbInterval,
} from "../period";

describe("addUtcMonths", () => {
  it("adds a month in the common case", () => {
    const d = new Date(Date.UTC(2026, 0, 15, 12, 0, 0)); // 2026-01-15 12:00 UTC
    expect(addUtcMonths(d, 1).toISOString()).toBe("2026-02-15T12:00:00.000Z");
  });

  it("clamps day when the target month is shorter (Jan 31 + 1 → Feb 28)", () => {
    const d = new Date(Date.UTC(2026, 0, 31));
    // 2026 is not a leap year → Feb 28.
    expect(addUtcMonths(d, 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("clamps day on leap year (Jan 31 + 1 → Feb 29 in 2028)", () => {
    const d = new Date(Date.UTC(2028, 0, 31));
    expect(addUtcMonths(d, 1).toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("rolls year forward when summed months exceed 12", () => {
    const d = new Date(Date.UTC(2026, 9, 1)); // Oct 1
    expect(addUtcMonths(d, 5).toISOString()).toBe("2027-03-01T00:00:00.000Z");
  });

  it("handles negative months", () => {
    const d = new Date(Date.UTC(2026, 2, 31)); // Mar 31
    // Feb clamps to 28 on non-leap.
    expect(addUtcMonths(d, -1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("preserves hour/minute/second/ms", () => {
    const d = new Date(Date.UTC(2026, 5, 10, 13, 45, 59, 123));
    expect(addUtcMonths(d, 1).toISOString()).toBe("2026-07-10T13:45:59.123Z");
  });
});

describe("addUtcYears", () => {
  it("adds years via month arithmetic (clamps Feb 29 on non-leap)", () => {
    const d = new Date(Date.UTC(2028, 1, 29)); // 2028-02-29
    expect(addUtcYears(d, 1).toISOString()).toBe("2029-02-28T00:00:00.000Z");
  });
});

describe("addInterval", () => {
  it("dispatches on month/year", () => {
    const d = new Date(Date.UTC(2026, 0, 1));
    expect(addInterval(d, "month", 2).toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
    expect(addInterval(d, "year", 1).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });

  it("defaults count to 1", () => {
    const d = new Date(Date.UTC(2026, 0, 1));
    expect(addInterval(d, "month").toISOString()).toBe(
      "2026-02-01T00:00:00.000Z",
    );
  });
});

describe("toApiInterval / toDbInterval", () => {
  it("maps DB ↔ API interval both directions", () => {
    expect(toApiInterval("MONTH")).toBe("month");
    expect(toApiInterval("YEAR")).toBe("year");
    expect(toApiInterval(null)).toBe("month");
    expect(toApiInterval(undefined)).toBe("month");
    expect(toDbInterval("month")).toBe("MONTH");
    expect(toDbInterval("year")).toBe("YEAR");
  });
});
