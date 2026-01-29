import { Auth0Client } from "@auth0/nextjs-auth0/server";
import type { AppUser } from "@trail/trpc";

export const auth0 = new Auth0Client();

const AUTH_BYPASS = process.env.ACCOUNT_AUTH_BYPASS === "1";

const devUser: AppUser = {
  id: "dev-local",
  email: "dev@gettrail.local",
  name: "Local Dev",
  imageUrl: null
};

type Auth0Session = Awaited<ReturnType<Auth0Client["getSession"]>>;
type Auth0GetSessionArg = Parameters<Auth0Client["getSession"]>[0];
type Auth0SessionData = NonNullable<Auth0Session>;

const devSession: Auth0SessionData = {
  user: {
    sub: "dev|local",
    name: devUser.name ?? "Local Dev",
    email: devUser.email ?? "dev@gettrail.local",
    picture: devUser.imageUrl ?? undefined
  },
  tokenSet: {
    accessToken: "dev-access-token",
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60,
    token_type: "Bearer"
  },
  internal: {
    sid: "dev-session",
    createdAt: Date.now()
  }
};

export function isAuthBypassed() {
  return AUTH_BYPASS;
}

export function getDevUser() {
  return devUser;
}

export async function getAuthSession(): Promise<Auth0Session>;
export async function getAuthSession(request: Auth0GetSessionArg): Promise<Auth0Session>;
export async function getAuthSession(request?: Auth0GetSessionArg): Promise<Auth0Session> {
  if (AUTH_BYPASS) {
    return devSession as Auth0Session;
  }

  if (request) {
    return auth0.getSession(request);
  }

  return auth0.getSession();
}
