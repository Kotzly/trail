import { jsonNoStore } from "@/src/server/response";

const INTERNAL_API_KEY = process.env.TRAIL_INTERNAL_API_KEY;

export function requireInternalKey(headers: Headers) {
  if (!INTERNAL_API_KEY) {
    return jsonNoStore({ error: "missing_TRAIL_INTERNAL_API_KEY" }, { status: 500 });
  }

  const providedKey = headers.get("x-trail-internal-key");
  if (!providedKey || providedKey !== INTERNAL_API_KEY) {
    return jsonNoStore({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}
