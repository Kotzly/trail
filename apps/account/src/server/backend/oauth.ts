import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@trail/db";
import { singleRow, maybeRow, assertOk } from "@trail/db/helpers";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { createSignedExtensionToken } from "@trail/trpc";
import { env } from "@/src/env";

const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_TTL_SECONDS = 5 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const DEFAULT_CLIENT_ID = "trail-extension";
const DEFAULT_SCOPE = "trail.extension";
const PKCE_METHOD = "S256";

type TokenSet = {
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  tokenType: "Bearer";
  scope: string;
};

type ExchangeResult =
  | { ok: true; tokens: TokenSet; userId: string }
  | {
      ok: false;
      reason:
        | "invalid_grant"
        | "invalid_client"
        | "invalid_request"
        | "server_error";
    };

type RefreshResult =
  | { ok: true; tokens: TokenSet; userId: string }
  | {
      ok: false;
      reason: "invalid_grant" | "invalid_client" | "invalid_request";
    };

// Row shapes for typed casts
type AuthCodeRow = {
  id: string;
  code_hash: string;
  user_id: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  scope: string | null;
  state: string | null;
  device_id: string | null;
  expires_at: string;
  used_at: string | null;
  users: { id: string; auth_session_version: number };
};

type RefreshTokenRow = {
  id: string;
  token_hash: string;
  user_id: string;
  device_session_id: string;
  client_id: string;
  scope: string | null;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  users: { id: string; auth_session_version: number };
  extension_device_sessions: { id: string; status: string; revoked_at: string | null };
};

type DeviceSessionRow = {
  id: string;
  user_id: string;
  device_id: string;
  status: string;
  session_version: number;
  revoked_at: string | null;
  last_seen_at: string;
};

function typed<T>(res: unknown): PostgrestSingleResponse<T> {
  return res as PostgrestSingleResponse<T>;
}

function base64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Base64Url(value: string): string {
  return base64Url(createHash("sha256").update(value).digest());
}

function nowIso(): string {
  return new Date().toISOString();
}

function createCode(): string {
  return base64Url(randomBytes(32));
}

function createRefreshToken(): string {
  return base64Url(randomBytes(48));
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  try {
    return timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function normalizeClientId(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : DEFAULT_CLIENT_ID;
}

function normalizeScope(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : DEFAULT_SCOPE;
}

async function issueAccessToken(input: {
  userId: string;
  authSessionVersion: number;
  deviceSessionId: string;
}): Promise<{ accessToken: string; expiresAt: string }> {
  const signed = createSignedExtensionToken(
    env.TRAIL_EXTENSION_JWT_SECRET,
    input.userId,
    ACCESS_TOKEN_TTL_SECONDS,
    {
      sid: input.deviceSessionId,
      ver: input.authSessionVersion,
    },
  );

  return {
    accessToken: signed.token,
    expiresAt: signed.expiresAt,
  };
}

export async function createOAuthAuthorizationCode(input: {
  userId: string;
  clientId?: string | null;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod?: string | null;
  scope?: string | null;
  state?: string | null;
  deviceId?: string | null;
}) {
  const code = createCode();
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_MS);
  const clientId = normalizeClientId(input.clientId);
  const scope = normalizeScope(input.scope);
  const codeChallengeMethod = input.codeChallengeMethod?.trim() || PKCE_METHOD;

  assertOk(
    await db.from("oauth_authorization_codes").insert({
      code_hash: sha256Hex(code),
      user_id: input.userId,
      client_id: clientId,
      redirect_uri: input.redirectUri,
      code_challenge: input.codeChallenge,
      code_challenge_method: codeChallengeMethod,
      scope,
      state: input.state?.trim() || null,
      device_id: input.deviceId?.trim() || null,
      expires_at: expiresAt.toISOString(),
    }),
  );

  return { code, expiresAt, clientId, scope };
}

function buildTokenSet(input: {
  accessToken: string;
  accessExpiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  scope: string;
}): TokenSet {
  return {
    accessToken: input.accessToken,
    expiresAt: input.accessExpiresAt,
    refreshToken: input.refreshToken,
    refreshExpiresAt: input.refreshExpiresAt,
    tokenType: "Bearer",
    scope: input.scope,
  };
}

export async function exchangeOAuthAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  clientId?: string | null;
  redirectUri: string;
  deviceId?: string | null;
}): Promise<ExchangeResult> {
  const codeHash = sha256Hex(input.code);
  const clientId = normalizeClientId(input.clientId);

  // Fetch auth code + user in one joined query
  const record = maybeRow(
    typed<AuthCodeRow | null>(
      await db
        .from("oauth_authorization_codes")
        .select("*, users!inner(id, auth_session_version)")
        .eq("code_hash", codeHash)
        .maybeSingle(),
    ),
  );

  if (!record) {
    return { ok: false, reason: "invalid_grant" };
  }
  if (record.used_at || new Date(record.expires_at).getTime() <= Date.now()) {
    return { ok: false, reason: "invalid_grant" };
  }
  if (record.client_id !== clientId || record.redirect_uri !== input.redirectUri) {
    return { ok: false, reason: "invalid_client" };
  }
  if (record.code_challenge_method !== PKCE_METHOD) {
    return { ok: false, reason: "invalid_request" };
  }

  const expectedChallenge = sha256Base64Url(input.codeVerifier);
  if (!safeEquals(expectedChallenge, record.code_challenge)) {
    return { ok: false, reason: "invalid_grant" };
  }

  const deviceId =
    record.device_id?.trim() ||
    input.deviceId?.trim() ||
    `device-${base64Url(randomBytes(12))}`;

  const refreshToken = createRefreshToken();
  const refreshTokenHash = sha256Hex(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  // Atomically consume the auth code — WHERE guard prevents double-redemption
  const consumed = await db
    .from("oauth_authorization_codes")
    .update({ used_at: nowIso() })
    .eq("id", record.id)
    .is("used_at", null)
    .gt("expires_at", nowIso())
    .select("id");

  if (consumed.error) {
    throw new Error(`Supabase query failed: ${consumed.error.message}`);
  }
  if (!consumed.data || (consumed.data as unknown[]).length === 0) {
    return { ok: false, reason: "invalid_grant" };
  }

  // Upsert the device session
  const existingSession = maybeRow(
    typed<Pick<DeviceSessionRow, "id" | "status" | "session_version" | "revoked_at"> | null>(
      await db
        .from("extension_device_sessions")
        .select("id, status, session_version, revoked_at")
        .eq("user_id", record.user_id)
        .eq("device_id", deviceId)
        .maybeSingle(),
    ),
  );

  let deviceSession: { id: string };

  if (!existingSession) {
    deviceSession = singleRow(
      typed<{ id: string }>(
        await db
          .from("extension_device_sessions")
          .insert({
            user_id: record.user_id,
            device_id: deviceId,
            status: "ACTIVE",
            session_version: 1,
            last_seen_at: nowIso(),
          })
          .select("id")
          .single(),
      ),
    );
  } else {
    const shouldBumpVersion =
      existingSession.status !== "ACTIVE" || existingSession.revoked_at;

    const updateData: Record<string, unknown> = {
      status: "ACTIVE",
      revoked_at: null,
      last_seen_at: nowIso(),
    };

    if (shouldBumpVersion) {
      updateData.session_version = (existingSession.session_version ?? 0) + 1;
    }

    deviceSession = singleRow(
      typed<{ id: string }>(
        await db
          .from("extension_device_sessions")
          .update(updateData)
          .eq("id", existingSession.id)
          .select("id")
          .single(),
      ),
    );
  }

  assertOk(
    await db.from("oauth_refresh_tokens").insert({
      token_hash: refreshTokenHash,
      user_id: record.user_id,
      device_session_id: deviceSession.id,
      client_id: clientId,
      scope: record.scope,
      expires_at: refreshExpiresAt.toISOString(),
    }),
  );

  const user = Array.isArray(record.users) ? record.users[0] : record.users;
  const access = await issueAccessToken({
    userId: record.user_id,
    authSessionVersion: user.auth_session_version,
    deviceSessionId: deviceSession.id,
  });

  return {
    ok: true,
    userId: record.user_id,
    tokens: buildTokenSet({
      accessToken: access.accessToken,
      accessExpiresAt: access.expiresAt,
      refreshToken,
      refreshExpiresAt: refreshExpiresAt.toISOString(),
      scope: record.scope ?? DEFAULT_SCOPE,
    }),
  };
}

export async function refreshOAuthToken(input: {
  refreshToken: string;
  clientId?: string | null;
}): Promise<RefreshResult> {
  const clientId = normalizeClientId(input.clientId);
  const tokenHash = sha256Hex(input.refreshToken);

  // Fetch refresh token + user + device session in one joined query
  const record = maybeRow(
    typed<RefreshTokenRow | null>(
      await db
        .from("oauth_refresh_tokens")
        .select(
          "*, users!inner(id, auth_session_version), extension_device_sessions!inner(id, status, revoked_at)",
        )
        .eq("token_hash", tokenHash)
        .maybeSingle(),
    ),
  );

  if (!record) {
    return { ok: false, reason: "invalid_grant" };
  }
  if (record.client_id !== clientId) {
    return { ok: false, reason: "invalid_client" };
  }
  if (
    record.used_at ||
    record.revoked_at ||
    new Date(record.expires_at).getTime() <= Date.now()
  ) {
    return { ok: false, reason: "invalid_grant" };
  }

  const deviceSession = Array.isArray(record.extension_device_sessions)
    ? record.extension_device_sessions[0]
    : record.extension_device_sessions;

  if (deviceSession.status !== "ACTIVE" || deviceSession.revoked_at) {
    return { ok: false, reason: "invalid_grant" };
  }

  const nextRefreshToken = createRefreshToken();
  const nextRefreshHash = sha256Hex(nextRefreshToken);
  const nextRefreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  // Atomically consume the refresh token — WHERE guard prevents double-rotation
  const consumed = await db
    .from("oauth_refresh_tokens")
    .update({ used_at: nowIso(), revoked_at: nowIso() })
    .eq("id", record.id)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", nowIso())
    .select("id");

  if (consumed.error) {
    throw new Error(`Supabase query failed: ${consumed.error.message}`);
  }
  if (!consumed.data || (consumed.data as unknown[]).length === 0) {
    return { ok: false, reason: "invalid_grant" };
  }

  assertOk(
    await db.from("oauth_refresh_tokens").insert({
      token_hash: nextRefreshHash,
      user_id: record.user_id,
      device_session_id: record.device_session_id,
      client_id: clientId,
      scope: record.scope,
      expires_at: nextRefreshExpiresAt.toISOString(),
    }),
  );

  const user = Array.isArray(record.users) ? record.users[0] : record.users;
  const access = await issueAccessToken({
    userId: record.user_id,
    authSessionVersion: user.auth_session_version,
    deviceSessionId: record.device_session_id,
  });

  return {
    ok: true,
    userId: record.user_id,
    tokens: buildTokenSet({
      accessToken: access.accessToken,
      accessExpiresAt: access.expiresAt,
      refreshToken: nextRefreshToken,
      refreshExpiresAt: nextRefreshExpiresAt.toISOString(),
      scope: record.scope ?? DEFAULT_SCOPE,
    }),
  };
}

export async function revokeOAuthRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = sha256Hex(refreshToken);
  assertOk(
    await db
      .from("oauth_refresh_tokens")
      .update({ revoked_at: nowIso() })
      .eq("token_hash", tokenHash)
      .is("revoked_at", null),
  );
}

export async function revokeAllExtensionSessionsForUser(
  userId: string,
): Promise<void> {
  // Revoke all active refresh tokens
  assertOk(
    await db
      .from("oauth_refresh_tokens")
      .update({ revoked_at: nowIso() })
      .eq("user_id", userId)
      .is("revoked_at", null),
  );

  // Revoke all active device sessions
  assertOk(
    await db
      .from("extension_device_sessions")
      .update({
        status: "REVOKED",
        revoked_at: nowIso(),
      })
      .eq("user_id", userId)
      .eq("status", "ACTIVE"),
  );

  // Bump auth session version — read-modify-write
  const current = maybeRow(
    typed<{ auth_session_version: number } | null>(
      await db
        .from("users")
        .select("auth_session_version")
        .eq("id", userId)
        .maybeSingle(),
    ),
  );

  if (current) {
    assertOk(
      await db
        .from("users")
        .update({
          auth_session_version: (current.auth_session_version ?? 0) + 1,
        })
        .eq("id", userId),
    );
  }
}
