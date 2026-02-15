import { resolveSafeNextPath } from "../auth-redirect";

describe("resolveSafeNextPath", () => {
  it("returns fallback for null/blank values", () => {
    expect(resolveSafeNextPath(null)).toBe("/trails");
    expect(resolveSafeNextPath("")).toBe("/trails");
    expect(resolveSafeNextPath("   ")).toBe("/trails");
  });

  it("returns normalized relative path", () => {
    expect(resolveSafeNextPath("/trails?x=1#h")).toBe("/trails?x=1#h");
  });

  it("rejects protocol relative and absolute URLs", () => {
    expect(resolveSafeNextPath("//evil.com")).toBe("/trails");
    expect(resolveSafeNextPath("https://evil.com/x")).toBe("/trails");
  });

  it("rejects non-http protocols", () => {
    expect(resolveSafeNextPath("javascript:alert(1)")).toBe("/trails");
  });

  it("honors a custom fallback", () => {
    expect(resolveSafeNextPath("https://evil.com/x", "/billing")).toBe(
      "/billing",
    );
  });
});
