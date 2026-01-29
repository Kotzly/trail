import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@trail/db";

export const runtime = "nodejs";

const SESSION_TTL_MS = 5 * 60 * 1000;

function createSessionId() {
  return randomBytes(16).toString("hex");
}

export async function POST() {
  const appBaseUrl = process.env.APP_BASE_URL ?? "https://app.gettrail.net";

  let sessionId = createSessionId();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await db.extensionLoginCode.findUnique({ where: { code: sessionId } });
    if (!existing) {
      break;
    }
    sessionId = createSessionId();
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  return NextResponse.json({
    id: sessionId,
    url: `${appBaseUrl.replace(/\/$/, "")}/extension?code=${sessionId}`,
    expiresAt: expiresAt.toISOString(),
    pollIntervalMs: 1500
  });
}
