import { NextResponse } from "next/server";

export function requireInternalKey(headers: Headers) {
  const expectedKey = process.env.TRAIL_INTERNAL_API_KEY;
  if (!expectedKey) {
    return NextResponse.json({ error: "missing_TRAIL_INTERNAL_API_KEY" }, { status: 500 });
  }

  const providedKey = headers.get("x-trail-internal-key");
  if (!providedKey || providedKey !== expectedKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}
