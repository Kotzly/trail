import { NextResponse } from "next/server";
import { env } from "@/lib/env";

type WaitlistPayload = {
  email?: string;
  source?: string;
};

type WaitlistSource = "marketing" | "account" | "extension";

const sourceAliases: Record<string, WaitlistSource> = {
  marketing: "marketing",
  account: "account",
  extension: "extension",
  "downloads-page": "marketing",
};

function normalizeSource(source: unknown): WaitlistSource {
  if (typeof source !== "string") {
    return "marketing";
  }

  const normalized = source.trim().toLowerCase();
  return sourceAliases[normalized] ?? "marketing";
}

const endpoint = env.WAITLIST_PROVIDER_ENDPOINT;
const token = env.WAITLIST_PROVIDER_TOKEN;

// todo: move to proper api endpoint
export async function POST(request: Request) {
  let payload: WaitlistPayload;

  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const email = payload.email?.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 },
    );
  }

  const body = {
    email,
    source: normalizeSource(payload.source),
    receivedAt: new Date().toISOString(),
  };

  if (endpoint) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: "provider_error" },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
