/**
 * CORS headers for the account API.
 *
 * Allowed origins:
 *   - NEXT_PUBLIC_APP_URL (first-party web app)
 *   - Each entry in OAUTH_ALLOWED_EXTENSION_IDS (comma-separated
 *     list of Chrome extension IDs), compiled to explicit
 *     `chrome-extension://<id>` origins.
 *
 * Previously the module used `origin.startsWith("chrome-extension://")`,
 * which allowed ANY installed Chrome extension to hit credentialed
 * endpoints — so a malicious extension the user installed could call
 * the account API with the user's cookie or bearer token (closes P1.1).
 */

function parseExtensionIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[a-p]{32}$/i.test(id))
    .map((id) => `chrome-extension://${id}`);
}

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  ...parseExtensionIds(process.env.OAUTH_ALLOWED_EXTENSION_IDS),
].filter(Boolean) as string[];

export function corsHeaders(origin?: string | null): Record<string, string> {
  const isAllowed = origin ? ALLOWED_ORIGINS.includes(origin) : false;
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  // Omit Access-Control-Allow-Origin entirely when the origin isn't
  // allowed (closes P1.7). An empty-string value is ambiguous and some
  // middleware treats it as a wildcard.
  if (isAllowed) {
    base["Access-Control-Allow-Origin"] = origin!;
    base["Vary"] = "Origin";
  }
  return base;
}

export function optionsResponse(request: Request): Response {
  const origin = request.headers.get("origin");
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
