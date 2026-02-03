import { createRemoteJWKSet } from "jose";

const JWKS_CACHE = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function getAuth0Jwks(issuer: string) {
  const normalized = issuer.replace(/\/$/, "");
  const cached = JWKS_CACHE.get(normalized);
  if (cached) {
    return cached;
  }

  const jwks = createRemoteJWKSet(new URL(`${normalized}/.well-known/jwks.json`));
  JWKS_CACHE.set(normalized, jwks);
  return jwks;
}
