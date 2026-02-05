import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

type ExtensionTokenPayload = {
  sub: string;
  iat: number;
  exp: number;
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

function getSecret(): string | null {
  return process.env.TRAIL_EXTENSION_JWT_SECRET ?? null;
}

export function createExtensionAccessToken(
  userId: string,
  ttlSeconds: number = TOKEN_TTL_SECONDS,
): { token: string; expiresAt: string } {
  const secret = getSecret();
  if (!secret) {
    throw new Error("missing_TRAIL_EXTENSION_JWT_SECRET");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: ExtensionTokenPayload = {
    sub: userId,
    iat: now,
    exp: now + ttlSeconds,
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

export function verifyExtensionAccessToken(
  token: string,
): ExtensionTokenPayload | null {
  const secret = getSecret();
  if (!secret) {
    return null;
  }

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
    const match = timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
    if (!match) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      fromBase64Url(payloadPart),
    ) as ExtensionTokenPayload;
    if (!payload?.sub || typeof payload.sub !== "string") {
      return null;
    }
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
