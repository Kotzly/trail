import { jwtVerify } from "jose";
import { getRemoteJwks } from "./jwks";
import { env } from "@/src/env";

export type UserTokenPayload = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  image?: string;
};

type VerifyOptions = {
  issuer?: string;
};

function normalizeBaseUrl(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

export async function verifyUserToken(
  token: string | null,
  options: VerifyOptions = {},
): Promise<UserTokenPayload | null> {
  if (!token) {
    return null;
  }

  const issuer =
    (options.issuer ? normalizeBaseUrl(options.issuer) : null) ??
    normalizeBaseUrl(env.BETTER_AUTH_URL);
  if (!issuer) {
    return null;
  }

  try {
    const jwks = getRemoteJwks(`${issuer}/api/auth/jwks`);
    const { payload } = await jwtVerify<UserTokenPayload>(token, jwks, {
      issuer,
    });

    if (!payload?.sub) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture ?? payload.image,
    };
  } catch {
    return null;
  }
}
