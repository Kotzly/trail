import { describe, it, expect, vi, beforeEach } from "vitest";

describe("corsHeaders", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  async function loadModule() {
    // Re-import to pick up fresh env values since ALLOWED_ORIGINS is
    // captured at module scope from process.env.NEXT_PUBLIC_APP_URL
    // and OAUTH_ALLOWED_EXTENSION_IDS.
    vi.resetModules();
    return import("@/src/server/api/cors");
  }

  it("allows a configured web origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.trail.dev");
    const { corsHeaders } = await loadModule();

    const headers = corsHeaders("https://app.trail.dev");
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://app.trail.dev",
    );
    expect(headers["Vary"]).toBe("Origin");
  });

  it("omits Access-Control-Allow-Origin for unknown origins", async () => {
    // Phase F (P1.1 + P1.7): previously an empty string was returned,
    // which some middleware treats as wildcard. The header is now
    // omitted entirely for disallowed origins.
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.trail.dev");
    const { corsHeaders } = await loadModule();

    const headers = corsHeaders("https://evil.com");
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(headers["Vary"]).toBeUndefined();
  });

  it("omits Access-Control-Allow-Origin for null/undefined origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.trail.dev");
    const { corsHeaders } = await loadModule();

    expect(corsHeaders(null)["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(
      corsHeaders(undefined)["Access-Control-Allow-Origin"],
    ).toBeUndefined();
  });

  it("requires allowlist opt-in for chrome-extension origins", async () => {
    // Phase F (P1.1): `chrome-extension://` origins are no longer
    // wildcarded — they must appear in OAUTH_ALLOWED_EXTENSION_IDS.
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.trail.dev");
    const { corsHeaders } = await loadModule();

    const headers = corsHeaders(
      "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef",
    );
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("allows allowlisted chrome-extension origin via OAUTH_ALLOWED_EXTENSION_IDS", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.trail.dev");
    vi.stubEnv(
      "OAUTH_ALLOWED_EXTENSION_IDS",
      "abcdefghijklmnopabcdefghijklmnop",
    );
    const { corsHeaders } = await loadModule();

    const headers = corsHeaders(
      "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
    );
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
    );
  });

  it("includes standard CORS headers", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.trail.dev");
    const { corsHeaders } = await loadModule();

    const headers = corsHeaders("https://app.trail.dev");
    expect(headers["Access-Control-Allow-Methods"]).toBe(
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    expect(headers["Access-Control-Allow-Headers"]).toBe(
      "Content-Type, Authorization",
    );
    expect(headers["Access-Control-Max-Age"]).toBe("86400");
  });
});

describe("optionsResponse", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  async function loadModule() {
    vi.resetModules();
    return import("@/src/server/api/cors");
  }

  it("returns 204 status", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.trail.dev");
    const { optionsResponse } = await loadModule();

    const request = new Request("https://app.trail.dev/api/test", {
      headers: { origin: "https://app.trail.dev" },
    });
    const response = optionsResponse(request);
    expect(response.status).toBe(204);
  });

  it("returns null body", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.trail.dev");
    const { optionsResponse } = await loadModule();

    const request = new Request("https://app.trail.dev/api/test", {
      headers: { origin: "https://app.trail.dev" },
    });
    const response = optionsResponse(request);
    expect(response.body).toBeNull();
  });

  it("includes CORS headers from the request origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.trail.dev");
    const { optionsResponse } = await loadModule();

    const request = new Request("https://app.trail.dev/api/test", {
      headers: { origin: "https://app.trail.dev" },
    });
    const response = optionsResponse(request);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.trail.dev",
    );
  });
});
