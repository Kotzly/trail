import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { db } from "@trail/db";
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

function now(): Date {
  return new Date();
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

  await db.oAuthAuthorizationCode.create({
    data: {
      codeHash: sha256Hex(code),
      userId: input.userId,
      clientId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod,
      scope,
      state: input.state?.trim() || null,
      deviceId: input.deviceId?.trim() || null,
      expiresAt,
    },
  });

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

  const record = await db.oAuthAuthorizationCode.findUnique({
    where: { codeHash },
    include: {
      user: {
        select: {
          id: true,
          authSessionVersion: true,
        },
      },
    },
  });

  if (!record) {
    return { ok: false, reason: "invalid_grant" };
  }
  if (record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "invalid_grant" };
  }
  if (record.clientId !== clientId || record.redirectUri !== input.redirectUri) {
    return { ok: false, reason: "invalid_client" };
  }
  if (record.codeChallengeMethod !== PKCE_METHOD) {
    return { ok: false, reason: "invalid_request" };
  }

  const expectedChallenge = sha256Base64Url(input.codeVerifier);
  if (!safeEquals(expectedChallenge, record.codeChallenge)) {
    return { ok: false, reason: "invalid_grant" };
  }

  const deviceId =
    record.deviceId?.trim() ||
    input.deviceId?.trim() ||
    `device-${base64Url(randomBytes(12))}`;

  const refreshToken = createRefreshToken();
  const refreshTokenHash = sha256Hex(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  let session;
  try {
    session = await db.$transaction(async (tx) => {
      // Atomically consume the auth code — WHERE guard prevents double-redemption
      const consumed = await tx.oAuthAuthorizationCode.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: now() } },
        data: { usedAt: now() },
      });
      if (consumed.count === 0) {
        throw new Error("AUTH_CODE_ALREADY_USED");
      }

      const current = await tx.extensionDeviceSession.findUnique({
        where: {
          userId_deviceId: {
            userId: record.userId,
            deviceId,
          },
        },
      });

      const deviceSession = !current
        ? await tx.extensionDeviceSession.create({
            data: {
              userId: record.userId,
              deviceId,
              status: "ACTIVE",
              sessionVersion: 1,
              lastSeenAt: now(),
            },
          })
        : await tx.extensionDeviceSession.update({
            where: { id: current.id },
            data: {
              status: "ACTIVE",
              revokedAt: null,
              lastSeenAt: now(),
              ...(current.status !== "ACTIVE" || current.revokedAt
                ? { sessionVersion: { increment: 1 } }
                : {}),
            },
          });

      await tx.oAuthRefreshToken.create({
        data: {
          tokenHash: refreshTokenHash,
          userId: record.userId,
          deviceSessionId: deviceSession.id,
          clientId,
          scope: record.scope,
          expiresAt: refreshExpiresAt,
        },
      });

      return deviceSession;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "AUTH_CODE_ALREADY_USED") {
      return { ok: false, reason: "invalid_grant" } as const;
    }
    throw err;
  }

  const access = await issueAccessToken({
    userId: record.userId,
    authSessionVersion: record.user.authSessionVersion,
    deviceSessionId: session.id,
  });

  return {
    ok: true,
    userId: record.userId,
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

  const record = await db.oAuthRefreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          authSessionVersion: true,
        },
      },
      deviceSession: {
        select: {
          id: true,
          status: true,
          revokedAt: true,
        },
      },
    },
  });

  if (!record) {
    return { ok: false, reason: "invalid_grant" };
  }
  if (record.clientId !== clientId) {
    return { ok: false, reason: "invalid_client" };
  }
  if (record.usedAt || record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "invalid_grant" };
  }
  if (record.deviceSession.status !== "ACTIVE" || record.deviceSession.revokedAt) {
    return { ok: false, reason: "invalid_grant" };
  }

  const nextRefreshToken = createRefreshToken();
  const nextRefreshHash = sha256Hex(nextRefreshToken);
  const nextRefreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  try {
    await db.$transaction(async (tx) => {
      // Atomically consume the refresh token — WHERE guard prevents double-rotation
      const consumed = await tx.oAuthRefreshToken.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now() },
        },
        data: { usedAt: now(), revokedAt: now() },
      });
      if (consumed.count === 0) {
        throw new Error("REFRESH_TOKEN_ALREADY_USED");
      }

      await tx.oAuthRefreshToken.create({
        data: {
          tokenHash: nextRefreshHash,
          userId: record.userId,
          deviceSessionId: record.deviceSessionId,
          clientId,
          scope: record.scope,
          expiresAt: nextRefreshExpiresAt,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "REFRESH_TOKEN_ALREADY_USED") {
      return { ok: false, reason: "invalid_grant" } as const;
    }
    throw err;
  }

  const access = await issueAccessToken({
    userId: record.userId,
    authSessionVersion: record.user.authSessionVersion,
    deviceSessionId: record.deviceSessionId,
  });

  return {
    ok: true,
    userId: record.userId,
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
  await db.oAuthRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: now() },
  });
}

export async function revokeAllExtensionSessionsForUser(
  userId: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.oAuthRefreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now() },
    });

    await tx.extensionDeviceSession.updateMany({
      where: { userId, status: "ACTIVE" },
      data: {
        status: "REVOKED",
        revokedAt: now(),
        sessionVersion: { increment: 1 },
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        authSessionVersion: { increment: 1 },
      },
    });
  });
}
