import { describe, it, expect, vi, beforeEach } from "vitest";

describe("corsHeaders", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  async function loadModule() {
    // Re-import to pick up fresh env values since ALLOWED_ORIGINS is
    // captured at module scope from process.env.NEXT_PUBLIC_APP_URL
    vi.resetModules();
    return import("@/src/server/api/cors");
  }

  it("allows a configured origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.trail.dev");
    const { corsHeaders } = await loadModule();

    const headers = corsHeaders("https://app.trail.dev");
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://app.trail.dev",
    );
  });

  it("blocks an unknown origin", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.trail.dev");
    const { corsHeaders } = await loadModule();

    const headers = corsHeaders("https://evil.com");
    expect(headers["Access-Control-Allow-Origin"]).toBe("");
  });

  it("allows chrome-extension:// origins", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.trail.dev");
    const { corsHeaders } = await loadModule();

    const headers = corsHeaders("chrome-extension://abcdef1234567890");
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "chrome-extension://abcdef1234567890",
    );
  });

  it("returns empty origin for null/undefined", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.trail.dev");
    const { corsHeaders } = await loadModule();

    expect(corsHeaders(null)["Access-Control-Allow-Origin"]).toBe("");
    expect(corsHeaders(undefined)["Access-Control-Allow-Origin"]).toBe("");
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
