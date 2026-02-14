import { buildAccountSnapshot } from "@/src/server/backend/account-snapshot";
import { jsonError } from "@/src/server/backend/error-response";
import { jsonNoStore } from "@/src/server/backend/response";
import { getPortalSessionStatus } from "@/src/server/backend/portal-sessions";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return jsonError("portal_not_found", "Portal session not found.", {
      status: 404,
    });
  }

  const result = await getPortalSessionStatus(id);
  if (!result) {
    return jsonError("portal_not_found", "Portal session not found.", {
      status: 404,
    });
  }

  if (result.status !== "approved") {
    return jsonNoStore({ status: result.status });
  }

  const { session, user } = result;
  if (!user || !session.extensionToken) {
    return jsonNoStore({ status: "expired" });
  }

  const snapshot = buildAccountSnapshot({
    user,
    accessToken: session.extensionToken,
    expiresAt: session.extensionTokenExpiresAt
      ? session.extensionTokenExpiresAt.toISOString()
      : null,
    onboardingSeenAt: user.onboardingSeenAt,
  });

  return jsonNoStore({ status: "approved", snapshot });
}
