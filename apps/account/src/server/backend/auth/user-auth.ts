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

function decodeIssuerClaim(token: string): string | null {
  const parts = token.split(".");
  const payloadPart = parts[1];
  if (!payloadPart) {
    return null;
  }

  try {
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      Math.ceil(normalized.length / 4) * 4,
      "=",
    );
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(decoded) as { iss?: unknown };
    return typeof payload.iss === "string" ? normalizeBaseUrl(payload.iss) : null;
  } catch {
    return null;
  }
}

export async function verifyUserToken(
  token: string | null,
  options: VerifyOptions = {},
): Promise<UserTokenPayload | null> {
  if (!token) {
    return null;
  }

  const primaryIssuer =
    (options.issuer ? normalizeBaseUrl(options.issuer) : null) ??
    normalizeBaseUrl(env.BETTER_AUTH_URL);
  if (!primaryIssuer) {
    return null;
  }

  const tokenIssuer = decodeIssuerClaim(token);
  const jwksIssuer =
    tokenIssuer === primaryIssuer
      ? tokenIssuer
      : primaryIssuer;

  try {
    const jwks = getRemoteJwks(`${jwksIssuer}/api/auth/jwks`);
    const { payload } = await jwtVerify<UserTokenPayload>(token, jwks, {
      issuer: primaryIssuer,
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
