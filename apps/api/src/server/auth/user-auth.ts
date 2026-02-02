import { jwtVerify } from "jose";
import { getAuth0Jwks } from "./jwks";

export type Auth0TokenPayload = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};

type VerifyOptions = {
  audience?: string;
  issuer?: string;
};

function normalizeIssuer(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  return `${trimmed}/`;
}

function getAuth0Issuer(): string | null {
  const domain = process.env.AUTH0_DOMAIN;
  if (!domain) {
    return null;
  }
  const resolved = domain.startsWith("http") ? domain : `https://${domain}`;
  return normalizeIssuer(resolved);
}

function getAuth0Audience(): string | null {
  return process.env.AUTH0_AUDIENCE ?? null;
}

export async function verifyUserToken(
  token: string | null,
  options: VerifyOptions = {}
): Promise<Auth0TokenPayload | null> {
  if (!token) {
    return null;
  }

  const issuer = options.issuer ? normalizeIssuer(options.issuer) : getAuth0Issuer();
  if (!issuer) {
    return null;
  }

  const audience = options.audience ?? getAuth0Audience();
  if (!audience) {
    return null;
  }

  try {
    const jwks = getAuth0Jwks(issuer);
    const { payload } = await jwtVerify<Auth0TokenPayload>(token, jwks, {
      issuer,
      audience
    });

    if (!payload?.sub) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    };
  } catch {
    return null;
  }
}
