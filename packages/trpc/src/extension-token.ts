import { createHmac, timingSafeEqual } from "crypto";

export const DEFAULT_EXTENSION_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

export type ExtensionTokenPayload = {
  sub: string;
  iat: number;
  exp: number;
  sid?: string;
  ver?: number;
};

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string): string {
  const padded = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(data: string, secret: string): string {
  return base64Url(createHmac("sha256", secret).update(data).digest());
}

export function createSignedExtensionToken(
  secret: string,
  userId: string,
  ttlSeconds: number = DEFAULT_EXTENSION_TOKEN_TTL_SECONDS,
  claims?: { sid?: string; ver?: number },
): { token: string; expiresAt: string } {
  const now = Math.floor(Date.now() / 1000);
  const payload: ExtensionTokenPayload = {
    sub: userId,
    iat: now,
    exp: now + ttlSeconds,
    ...(claims?.sid ? { sid: claims.sid } : {}),
    ...(typeof claims?.ver === "number" ? { ver: claims.ver } : {}),
  };

  const header = { alg: "HS256", typ: "JWT" };
  const headerPart = base64Url(JSON.stringify(header));
  const payloadPart = base64Url(JSON.stringify(payload));
  const data = `${headerPart}.${payloadPart}`;
  const signature = sign(data, secret);

  return {
    token: `${data}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function verifySignedExtensionToken(
  secret: string,
  token: string,
): ExtensionTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [headerPart, payloadPart, signature] = parts;
  const data = `${headerPart}.${payloadPart}`;
  const expected = sign(data, secret);
  if (signature.length !== expected.length) {
    return null;
  }

  try {
    const match = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!match) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const raw: unknown = JSON.parse(fromBase64Url(payloadPart));
    if (!raw || typeof raw !== "object") return null;
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.sub !== "string" || !candidate.sub) return null;
    if (typeof candidate.iat !== "number") return null;
    if (typeof candidate.exp !== "number" || candidate.exp * 1000 < Date.now()) return null;
    if (candidate.sid !== undefined && typeof candidate.sid !== "string") return null;
    if (candidate.ver !== undefined && typeof candidate.ver !== "number") return null;
    return {
      sub: candidate.sub,
      iat: candidate.iat,
      exp: candidate.exp,
      ...(typeof candidate.sid === "string" ? { sid: candidate.sid } : {}),
      ...(typeof candidate.ver === "number" ? { ver: candidate.ver } : {}),
    };
  } catch {
    return null;
  }
}
