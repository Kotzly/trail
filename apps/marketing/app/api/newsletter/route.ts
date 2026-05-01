import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { env } from "../../../lib/env";
import { createRateLimiter } from "../../../lib/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

const rateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 5,
});

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (rateLimiter.isLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  if (!env.RESEND_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "not_configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const { email, website } = body as {
    email?: string;
    website?: string;
  };

  // Honeypot — bots fill the hidden field. Return 200 so the bot can't
  // distinguish a tripped trap from a real submit.
  if (typeof website === "string" && website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  if (
    !email ||
    typeof email !== "string" ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_RE.test(email.trim())
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 },
    );
  }

  const resend = new Resend(env.RESEND_API_KEY);

  try {
    const result = await resend.contacts.create({
      email: email.trim().toLowerCase(),
      unsubscribed: false,
    });

    if (result.error) {
      const name = result.error.name ?? "";
      const message = result.error.message ?? "";
      // Treat "already subscribed" as success — user re-submitting is fine.
      if (/exists|conflict|duplicate/i.test(name) || /already/i.test(message)) {
        return NextResponse.json({ ok: true });
      }
      console.error("Resend contacts.create error:", result.error);
      return NextResponse.json(
        { ok: false, error: "send_failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Newsletter signup error:", err);
    return NextResponse.json(
      { ok: false, error: "send_failed" },
      { status: 500 },
    );
  }
}
