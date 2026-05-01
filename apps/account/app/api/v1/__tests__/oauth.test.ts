import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------

const supabaseMock = vi.hoisted(() => {
  const getUser = vi.fn<
    () => Promise<{ data: { user: { id: string } | null } }>
  >(async () => ({ data: { user: null } }));
  return {
    getUser,
    createSupabaseServerClient: vi.fn(async () => ({
      auth: { getUser },
    })),
  };
});

const oauthMocks = vi.hoisted(() => ({
  createOAuthAuthorizationCode: vi.fn(),
  exchangeOAuthAuthorizationCode: vi.fn(),
  refreshOAuthToken: vi.fn(),
  revokeOAuthRefreshToken: vi.fn(),
}));

const extensionAuthMocks = vi.hoisted(() => ({
  verifyExtensionToken: vi.fn(),
}));

const extensionConfigMocks = vi.hoisted(() => ({
  getExtensionConfig: vi.fn().mockReturnValue({ config: {} }),
}));

const userAuthMocks = vi.hoisted(() => ({
  verifyUserToken: vi.fn(),
}));

const fluentDb = vi.hoisted(() => {
  type QR = { data: unknown; error: null | { message: string; code?: string } };
  const tableMocks: Record<string, () => QR> = {};
  const passthrough = [
    "select",
    "eq",
    "neq",
    "is",
    "not",
    "in",
    "or",
    "order",
    "limit",
    "maybeSingle",
    "single",
    "upsert",
    "insert",
    "update",
    "delete",
    "ignoreDuplicates",
  ] as const;

  function makeChain(result: QR) {
    const chain: Record<string, unknown> = {};
    for (const m of passthrough) {
      chain[m] = (..._args: unknown[]) => {
        if (m === "maybeSingle" || m === "single")
          return Promise.resolve(result);
        return chain;
      };
    }
    chain.then = (
      resolve: (v: QR) => unknown,
      reject: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject);
    return chain;
  }

  const db = {
    from: vi.fn((table: string) => {
      const factory = tableMocks[table];
      const result = factory ? factory() : { data: null, error: null };
      return makeChain(result);
    }),
  };

  function setTable(table: string, result: QR) {
    tableMocks[table] = () => result;
  }

  function reset() {
    db.from.mockClear();
    for (const k of Object.keys(tableMocks)) delete tableMocks[k];
  }

  return { db, setTable, reset };
});

vi.mock("@/src/lib/supabase/server", () => ({
  createSupabaseServerClient: supabaseMock.createSupabaseServerClient,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

vi.mock("@/src/server/backend/oauth", () => ({ ...oauthMocks }));
vi.mock("@/src/server/backend/auth/extension-auth", () => ({
  ...extensionAuthMocks,
}));
vi.mock("@/src/server/backend/extension-config", () => ({
  ...extensionConfigMocks,
}));
vi.mock("@/src/server/backend/auth/user-auth", () => ({ ...userAuthMocks }));
vi.mock("@trail/db", () => ({ db: fluentDb.db }));
vi.mock("@trail/db/helpers", () => ({
  maybeRow: <T>(res: { data: unknown }) => (res.data as T) ?? null,
}));

// Imports MUST come after vi.mock so the mocks bind first.
import { GET as oauthAuthorize } from "../oauth/authorize/route";
import { POST as oauthToken } from "../oauth/token/route";
import { POST as oauthRevoke } from "../oauth/revoke/route";
import { GET as authSessionState } from "../auth/session-state/route";

const REDIRECT_URI = "https://trail-dev.chromiumapp.org/oauth-callback";
const BASE_AUTHORIZE_QUERY = `response_type=code&client_id=trail-extension&redirect_uri=${encodeURIComponent(
  REDIRECT_URI,
)}&code_challenge=${"a".repeat(43)}&code_challenge_method=S256`;

function setSupabaseUser(user: { id: string } | null) {
  supabaseMock.getUser.mockResolvedValue({ data: { user } });
}

describe("v1 oauth auth flow", () => {
  beforeEach(() => {
    supabaseMock.getUser.mockReset();
    setSupabaseUser(null);
    oauthMocks.createOAuthAuthorizationCode.mockReset();
    oauthMocks.exchangeOAuthAuthorizationCode.mockReset();
    oauthMocks.refreshOAuthToken.mockReset();
    oauthMocks.revokeOAuthRefreshToken.mockReset();
    extensionAuthMocks.verifyExtensionToken.mockReset();
    userAuthMocks.verifyUserToken.mockReset();
    fluentDb.reset();
  });

  it("redirects prompt=none to login_required when web session is missing", async () => {
    setSupabaseUser(null);

    const response = await oauthAuthorize(
      new Request(
        `http://localhost/api/v1/oauth/authorize?${BASE_AUTHORIZE_QUERY}&prompt=none&state=req-1`,
      ),
    );

    expect(response.status).toBe(307);
    const target = new URL(response.headers.get("location") as string);
    expect(target.origin + target.pathname).toBe(REDIRECT_URI);
    expect(target.searchParams.get("error")).toBe("login_required");
    expect(target.searchParams.get("state")).toBe("req-1");
  });

  it("forces interactive chooser for prompt=select_account", async () => {
    setSupabaseUser({ id: "user-1" });

    const response = await oauthAuthorize(
      new Request(
        `http://localhost/api/v1/oauth/authorize?${BASE_AUTHORIZE_QUERY}&prompt=select_account`,
      ),
    );

    expect(response.status).toBe(307);
    const target = new URL(response.headers.get("location") as string);
    expect(target.pathname).toBe("/login");
    expect(target.searchParams.get("prompt")).toBe("select_account");
    expect(target.searchParams.get("maxAge")).toBe("0");
    expect(target.searchParams.get("returnTo")).toContain(
      "/api/v1/oauth/authorize",
    );
  });

  it("issues code and redirects to callback when session exists", async () => {
    setSupabaseUser({ id: "user-1" });
    oauthMocks.createOAuthAuthorizationCode.mockResolvedValue({
      code: "auth-code-1",
      expiresAt: new Date("2026-02-14T12:00:00.000Z"),
      clientId: "trail-extension",
      scope: "trail.extension",
    });

    const response = await oauthAuthorize(
      new Request(
        `http://localhost/api/v1/oauth/authorize?${BASE_AUTHORIZE_QUERY}&state=req-2`,
      ),
    );

    expect(response.status).toBe(307);
    expect(oauthMocks.createOAuthAuthorizationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        redirectUri: REDIRECT_URI,
      }),
    );
    const target = new URL(response.headers.get("location") as string);
    expect(target.searchParams.get("code")).toBe("auth-code-1");
    expect(target.searchParams.get("state")).toBe("req-2");
  });

  it("returns 400 for invalid redirect_uri", async () => {
    const response = await oauthAuthorize(
      new Request(
        `http://localhost/api/v1/oauth/authorize?response_type=code&client_id=trail-extension&redirect_uri=${encodeURIComponent(
          "https://evil.example/callback",
        )}&code_challenge=${"a".repeat(43)}&code_challenge_method=S256`,
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_request",
    });
  });

  it("exchanges authorization code for tokens", async () => {
    oauthMocks.exchangeOAuthAuthorizationCode.mockResolvedValue({
      ok: true,
      userId: "user-1",
      tokens: {
        accessToken: "access-1",
        expiresAt: "2026-02-14T12:05:00.000Z",
        refreshToken: "refresh-1",
        refreshExpiresAt: "2026-03-14T12:00:00.000Z",
        tokenType: "Bearer",
        scope: "trail.extension",
      },
    });

    const response = await oauthToken(
      new Request("http://localhost/api/v1/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code: "code-1",
          code_verifier: "verifier-1",
          redirect_uri: REDIRECT_URI,
          client_id: "trail-extension",
          device_id: "device-1",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      access_token: "access-1",
      refresh_token: "refresh-1",
      token_type: "Bearer",
    });
  });

  it("rejects refresh token reuse with invalid_grant", async () => {
    oauthMocks.refreshOAuthToken.mockResolvedValue({
      ok: false,
      reason: "invalid_grant",
    });

    const response = await oauthToken(
      new Request("http://localhost/api/v1/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          refresh_token: "reused-refresh-token",
          client_id: "trail-extension",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_grant",
    });
  });

  it("returns 400 with unsupported_grant_type for unknown grant types (RFC 6749 §5.2)", async () => {
    const response = await oauthToken(
      new Request("http://localhost/api/v1/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "client_credentials" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "unsupported_grant_type",
    });
  });

  it("revokes refresh token", async () => {
    oauthMocks.revokeOAuthRefreshToken.mockResolvedValue(undefined);

    const response = await oauthRevoke(
      new Request("http://localhost/api/v1/oauth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: "refresh-1" }),
      }),
    );

    expect(response.status).toBe(204);
    expect(oauthMocks.revokeOAuthRefreshToken).toHaveBeenCalledWith(
      "refresh-1",
    );
  });

  it("returns extension session-state from bearer token", async () => {
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue({
      sub: "user-1",
      sid: "ext-session-1",
      ver: 7,
      iat: 1,
      exp: 2,
    });

    const response = await authSessionState(
      new Request("http://localhost/api/v1/auth/session-state", {
        headers: { Authorization: "Bearer access-1" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "authenticated",
      source: "extension",
      userId: "user-1",
      sessionId: "ext-session-1",
      authSessionVersion: 7,
      config: {},
    });
  });

  it("returns web session-state from Supabase cookie session", async () => {
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue(null);
    setSupabaseUser({ id: "user-2" });
    fluentDb.setTable("users", {
      data: { auth_session_version: 3 },
      error: null,
    });

    const response = await authSessionState(
      new Request("http://localhost/api/v1/auth/session-state", {
        headers: { cookie: "sb-access-token=value" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "authenticated",
      source: "web",
      userId: "user-2",
      authSessionVersion: 3,
      config: {},
    });
  });

  it("returns guest session-state when no credentials are present", async () => {
    extensionAuthMocks.verifyExtensionToken.mockResolvedValue(null);
    setSupabaseUser(null);

    const response = await authSessionState(
      new Request("http://localhost/api/v1/auth/session-state"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "guest",
      config: {},
    });
  });
});
