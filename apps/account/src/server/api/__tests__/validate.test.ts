import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseBody, parseQuery } from "@/src/server/api/validate";

const testSchema = z.object({
  name: z.string(),
  age: z.number().int().positive(),
});

describe("parseBody", () => {
  it("returns ok: true with parsed data for valid input", () => {
    const result = parseBody(testSchema, { name: "Alice", age: 30 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ name: "Alice", age: 30 });
    }
  });

  it("returns ok: false with ZodError for invalid input", () => {
    const result = parseBody(testSchema, { name: 123, age: "not-a-number" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(z.ZodError);
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("returns ok: false when required field is missing", () => {
    const result = parseBody(testSchema, { name: "Alice" });
    expect(result.ok).toBe(false);
  });

  it("returns ok: false for completely wrong data type", () => {
    const result = parseBody(testSchema, "not-an-object");
    expect(result.ok).toBe(false);
  });

  it("returns ok: false for null input", () => {
    const result = parseBody(testSchema, null);
    expect(result.ok).toBe(false);
  });
});

describe("parseQuery", () => {
  const querySchema = z.object({
    page: z.string().optional(),
    q: z.string(),
  });

  it("returns ok: true with parsed data for valid search params", () => {
    const params = new URLSearchParams("q=hello&page=2");
    const result = parseQuery(querySchema, params);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ q: "hello", page: "2" });
    }
  });

  it("returns ok: false when required param is missing", () => {
    const params = new URLSearchParams("page=1");
    const result = parseQuery(querySchema, params);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(z.ZodError);
    }
  });

  it("returns ok: true when optional param is absent", () => {
    const params = new URLSearchParams("q=search-term");
    const result = parseQuery(querySchema, params);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.page).toBeUndefined();
      expect(result.data.q).toBe("search-term");
    }
  });

  it("handles empty search params", () => {
    const params = new URLSearchParams("");
    const result = parseQuery(querySchema, params);
    expect(result.ok).toBe(false);
  });
});
