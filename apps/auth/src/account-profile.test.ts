/**
 * @vitest-environment node
 */
import {
  buildDisplayName,
  normalizeEmail,
  normalizeImageUrl,
  splitDisplayName,
} from "./account-profile";
import { describe, expect, it } from "vitest";

describe("account profile helpers", () => {
  it("splits first and last name from a full name", () => {
    expect(splitDisplayName("Ada Lovelace Byron")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace Byron",
    });
  });

  it("returns empty names for blank input", () => {
    expect(splitDisplayName("   ")).toEqual({
      firstName: "",
      lastName: "",
    });
  });

  it("builds display name from first and last name", () => {
    expect(buildDisplayName("  Ada  ", "  Lovelace ")).toBe("Ada Lovelace");
    expect(buildDisplayName("  Ada  ", "   ")).toBe("Ada");
  });

  it("normalizes email by trimming and lowercasing", () => {
    expect(normalizeEmail("  User+tag@Example.COM ")).toBe(
      "user+tag@example.com",
    );
  });

  it("returns null when image URL is empty", () => {
    expect(normalizeImageUrl("   ")).toBeNull();
  });

  it("accepts valid HTTP(S) image URL", () => {
    expect(normalizeImageUrl("https://cdn.trail.net/avatar.png")).toBe(
      "https://cdn.trail.net/avatar.png",
    );
  });

  it("throws for non-http protocols", () => {
    expect(() => normalizeImageUrl("javascript:alert(1)")).toThrow(
      "photo must be a valid http(s) url",
    );
  });

  it("throws for invalid URL value", () => {
    expect(() => normalizeImageUrl("not-a-url")).toThrow(
      "photo must be a valid http(s) url",
    );
  });
});
