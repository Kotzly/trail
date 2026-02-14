import { createRemoteJWKSet } from "jose";

const JWKS_CACHE = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function getRemoteJwks(jwksUrl: string) {
  const normalized = jwksUrl.trim().replace(/\/$/, "");
  const cached = JWKS_CACHE.get(normalized);
  if (cached) {
    return cached;
  }

  const jwks = createRemoteJWKSet(new URL(normalized));
  JWKS_CACHE.set(normalized, jwks);
  return jwks;
}
