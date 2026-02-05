import "server-only";

import { cookies } from "next/headers";
import type { UUID } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@/src/env";

export const AUTH_COOKIE_NAME = "trail_auth_session";

type AuthSession = {
  user: User;
};

export async function getAuthSession(): Promise<AuthSession | null> {
  if (getAuthBypassState()) {
    return { user: devUser };
  }

  const token = await getAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  const user = await getUserFromToken(token);
  return user ? { user } : null;
}

export function isAuthBypassed() {
  return getAuthBypassState();
}

export const devUser: User = {
  id: "uuiddev1-2345-6789-0123-456789012345",
  email: "dev@gettrail.local",
  name: "Local Dev",
};

type CommonUserClaims = {
  email: string;
  name: string;
  imageUrl?: string;
};

type UserClaims = CommonUserClaims & {
  sub: UUID;
  exp: number;
  picture?: string;
};

export type User = CommonUserClaims & {
  id: UUID;
};

export function getAuthBypassState(): boolean {
  return env.ACCOUNT_AUTH_BYPASS;
}

export async function getAuthTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

const JWKS_CACHE = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function normalizeBaseUrl(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

function resolveAuthIssuer(): string | null {
  return normalizeBaseUrl(env.TRAIL_AUTH_BASE_URL);
}

function getRemoteJwks(jwksUrl: string) {
  const normalized = jwksUrl.trim().replace(/\/$/, "");
  const cached = JWKS_CACHE.get(normalized);
  if (cached) {
    return cached;
  }
  const jwks = createRemoteJWKSet(new URL(normalized));
  JWKS_CACHE.set(normalized, jwks);
  return jwks;
}

export async function getUserFromToken(
  token: string,
): Promise<User | undefined> {
  if (!token) {
    return undefined;
  }

  const issuer = resolveAuthIssuer();
  if (!issuer) {
    return undefined;
  }

  try {
    const jwks = getRemoteJwks(`${issuer}/api/auth/jwks`);
    const { payload } = await jwtVerify<UserClaims>(token, jwks, { issuer });

    if (!payload?.sub) {
      return undefined;
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      imageUrl: payload.imageUrl ?? payload.picture,
    };
  } catch {
    return undefined;
  }
}
