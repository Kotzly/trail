import { getBearerToken } from "../auth-headers";

function headersWithAuthorization(value: string): Headers {
  return new Headers({ authorization: value });
}

describe("getBearerToken", () => {
  it("accepts canonical Bearer scheme", () => {
    const token = getBearerToken(headersWithAuthorization("Bearer abc"));
    expect(token).toBe("abc");
  });

  it("accepts lowercase scheme", () => {
    const token = getBearerToken(headersWithAuthorization("bearer abc"));
    expect(token).toBe("abc");
  });

  it("accepts extra whitespace", () => {
    const token = getBearerToken(headersWithAuthorization("  Bearer   abc  "));
    expect(token).toBe("abc");
  });

  it("rejects non bearer scheme", () => {
    const token = getBearerToken(headersWithAuthorization("Basic abc"));
    expect(token).toBeNull();
  });

  it("rejects missing token", () => {
    const token = getBearerToken(headersWithAuthorization("Bearer"));
    expect(token).toBeNull();
  });

  it("rejects token with extra chunks", () => {
    const token = getBearerToken(headersWithAuthorization("Bearer a b"));
    expect(token).toBeNull();
  });
});
