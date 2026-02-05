import "server-only";

import {
  type AuthUser,
  getAuthTokenFromCookies,
  getAuthUserFromToken,
  getDevUser,
  isAuthBypassed as getAuthBypassState
} from "@/src/lib/auth";

type AuthSession = {
  user: AuthUser;
};

export async function getAuthSession(): Promise<AuthSession | null> {
  if (getAuthBypassState()) {
    const devUser = getDevUser();
    return {
      user: {
        id: devUser.id,
        email: devUser.email ?? undefined,
        name: devUser.name ?? undefined,
        imageUrl: devUser.imageUrl ?? null,
        picture: devUser.imageUrl ?? null
      }
    };
  }

  const token = await getAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  const user = getAuthUserFromToken(token);
  return user ? { user } : null;
}

export function isAuthBypassed() {
  return getAuthBypassState();
}
