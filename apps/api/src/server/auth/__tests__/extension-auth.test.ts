import { describe, expect, it } from "vitest";
import { createExtensionToken, verifyExtensionToken } from "../extension-auth";

describe("extension auth tokens", () => {
  it("creates and verifies token", () => {
    process.env.TRAIL_EXTENSION_JWT_SECRET = "test-secret";
    const token = createExtensionToken("user_1", 60).token;
    const payload = verifyExtensionToken(token);
    expect(payload?.sub).toBe("user_1");
  });
});
