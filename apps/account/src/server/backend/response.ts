import { NextResponse } from "next/server";

export function jsonNoStore<T>(data: T, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(data, { ...init, headers });
}

// Re-export new helpers for convenience
export { jsonOk, jsonFail } from "./error-response";
