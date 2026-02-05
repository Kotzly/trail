import "server-only";

import { jwtDecode } from "jwt-decode";
import { cookies } from "next/headers";
import type { UUID } from "crypto";

export const AUTH_COOKIE_NAME = "trail_auth_session";
const AUTH_BYPASS = process.env.ACCOUNT_AUTH_BYPASS === "1" as const;

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

  const user = getUserFromToken(token);
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
}

type UserClaims = CommonUserClaims & {
  sub: UUID;
  exp: number;
}

export type User = CommonUserClaims & {
  id: UUID;
}

export function getAuthBypassState(): boolean {
  return AUTH_BYPASS;
}

export async function getAuthTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export function getUserFromToken(token: string): User | undefined {
  if (!token) {
    return undefined;
  }

  try {
    const payload = jwtDecode(token) as UserClaims;

    if (payload.exp * 1000 < Date.now()) {
      return undefined;
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      imageUrl: payload.imageUrl
    };
  } catch {
    return undefined;
  } 
}
