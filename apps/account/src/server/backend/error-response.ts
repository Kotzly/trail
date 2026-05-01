import { NextResponse } from "next/server";

// ── Success response ────────────────────────────────────────────────
// Returns flat data — NO wrapper. Extension sync client does
// `return json as T` (api.ts:195) and expects the raw shape.

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(data, { ...init, headers });
}

// ── Error response ──────────────────────────────────────────────────
// Extension account client reads `code` and `message` at top level
// (remote.ts:74-86). We keep them flat — same contract as before.

type ErrorInit = ResponseInit & {
  retryable?: boolean;
  details?: string;
};

export function jsonFail(
  code: string,
  message: string,
  init: ErrorInit = {},
): Response {
  const { retryable, details, ...responseInit } = init;
  const payload: Record<string, unknown> = { code, message };

  if (retryable !== undefined) payload.retryable = retryable;
  if (details) payload.details = details;

  const headers = new Headers(responseInit.headers);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(payload, { ...responseInit, headers });
}

// ── Backward compat aliases (will be removed after full migration) ──
export const jsonError = jsonFail;
