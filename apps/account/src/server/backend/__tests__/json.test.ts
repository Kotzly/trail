import { describe, expect, it } from "vitest";
import { isJsonValue, toPrismaJsonInput } from "../json";

describe("isJsonValue", () => {
  it("accepts JSON primitives and structures", () => {
    expect(isJsonValue("text")).toBe(true);
    expect(isJsonValue(42)).toBe(true);
    expect(isJsonValue(false)).toBe(true);
    expect(isJsonValue(null)).toBe(true);
    expect(isJsonValue(["a", 1, true, null])).toBe(true);
    expect(isJsonValue({ a: "b", nested: { c: 1 }, list: [1, 2, 3] })).toBe(
      true,
    );
  });

  it("rejects non-JSON values", () => {
    expect(isJsonValue(undefined)).toBe(false);
    expect(isJsonValue(() => {})).toBe(false);
    expect(isJsonValue(new Date())).toBe(false);
    expect(isJsonValue(new Map())).toBe(false);
    expect(isJsonValue({ bad: undefined })).toBe(false);
  });
});

describe("toPrismaJsonInput", () => {
  it("passes null through as null", () => {
    expect(toPrismaJsonInput(null)).toBeNull();
  });

  it("passes through non-null JSON values", () => {
    const payload = { a: ["b", 2], c: true };
    expect(toPrismaJsonInput(payload)).toBe(payload);
  });
});
