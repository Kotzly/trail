import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/src/auth";
import { db } from "@trail/db";

const CODE_TTL_MINUTES = 10;

function parseAllowedOrigins(): Set<string> {
  const raw = process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "";
  const entries = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(entries);
}

function resolveDefaultReturnTo(): string {
  return (
    process.env.AUTH_BRIDGE_DEFAULT_RETURN_TO ?? "https://app.gettrail.net"
  );
}

function sanitizeReturnTo(raw: string | null): string {
  if (!raw) {
    return resolveDefaultReturnTo();
  }

  if (raw.startsWith("/")) {
    return `${resolveDefaultReturnTo().replace(/\/$/, "")}${raw}`;
  }

  try {
    const url = new URL(raw);
    const allowedOrigins = parseAllowedOrigins();
    if (allowedOrigins.size === 0 || allowedOrigins.has(url.origin)) {
      return url.toString();
    }
  } catch {
    // Ignore invalid URLs.
  }

  return resolveDefaultReturnTo();
}

function appendBridgeCode(returnTo: string, code: string): string {
  const url = new URL(returnTo);
  url.searchParams.set("code", code);
  return url.toString();
}

export default async function AuthBridgePage({
  searchParams,
}: {
  searchParams: { returnTo?: string };
}) {
  const headerList = await headers();
  const session = await auth.api.getSession({
    headers: new Headers(headerList),
  });

  if (!session?.user?.id) {
    const returnTo = sanitizeReturnTo(searchParams.returnTo ?? null);
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const tokenResponse = await auth.api.getToken({
    headers: new Headers(headerList),
  });
  const token = tokenResponse?.token;

  if (!token) {
    const returnTo = sanitizeReturnTo(searchParams.returnTo ?? null);
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const code = randomUUID();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await db.authBridgeCode.create({
    data: {
      code,
      userId: session.user.id,
      jwt: token,
      expiresAt,
    },
  });

  const returnTo = sanitizeReturnTo(searchParams.returnTo ?? null);
  redirect(appendBridgeCode(returnTo, code));
}
