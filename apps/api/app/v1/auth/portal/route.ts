import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { createPortalSession, PORTAL_POLL_INTERVAL_MS } from "@/src/server/portal-sessions";

export const runtime = "nodejs";

function normalizeString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const source = normalizeString(body?.source);
  const locale = normalizeString(body?.locale);
  const returnUrl = normalizeString(body?.returnUrl);

  let session;
  try {
    session = await createPortalSession({ source, locale, returnUrl });
  } catch (error) {
    return jsonError("portal_create_failed", "Could not create portal session.", {
      status: 500,
      retryable: true
    });
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? "https://app.gettrail.net";
  const confirmUrl = new URL("/extension/confirm", appBaseUrl);
  confirmUrl.searchParams.set("portal", session.id);
  if (returnUrl) {
    confirmUrl.searchParams.set("returnUrl", returnUrl);
  }

  return jsonNoStore({
    id: session.id,
    url: confirmUrl.toString(),
    expiresAt: session.expiresAt.toISOString(),
    pollIntervalMs: PORTAL_POLL_INTERVAL_MS
  });
}
