import "server-only";

import { decodeJwt } from "jose";
import { cookies } from "next/headers";
import type { AppUser } from "@trail/trpc";

const AUTH_COOKIE_NAME = "trail_auth_session";
const AUTH_BYPASS = process.env.ACCOUNT_AUTH_BYPASS === "1";

const devUser: AppUser = {
  id: "dev-local",
  email: "dev@gettrail.local",
  name: "Local Dev",
  imageUrl: null
};

type AuthTokenClaims = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  image?: string;
};

export type AuthUser = {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
  imageUrl?: string | null;
  picture?: string | null;
};

export function getAuthCookieName() {
  return AUTH_COOKIE_NAME;
}

export function isAuthBypassed() {
  return AUTH_BYPASS;
}

export function getDevUser() {
  return devUser;
}

export async function getAuthTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export function getAuthUserFromToken(token: string): AuthUser | null {
  if (!token) {
    return null;
  }

  try {
    const payload = decodeJwt(token) as AuthTokenClaims;
    const sub = typeof payload.sub === "string" ? payload.sub : undefined;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    const name = typeof payload.name === "string" ? payload.name : undefined;
    const image =
      typeof payload.picture === "string"
        ? payload.picture
        : typeof payload.image === "string"
          ? payload.image
          : undefined;

    if (!sub && !email && !name && !image) {
      return null;
    }

    return {
      id: sub,
      sub,
      email,
      name,
      imageUrl: image ?? null,
      picture: image ?? null
    };
  } catch {
    return null;
  }
}
