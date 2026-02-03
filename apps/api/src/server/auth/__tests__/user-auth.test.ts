import { describe, expect, it } from "vitest";
import { verifyUserToken } from "../user-auth";

describe("verifyUserToken", () => {
  it("rejects missing token", async () => {
    await expect(verifyUserToken(null)).resolves.toBeNull();
  });
});
