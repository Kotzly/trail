import { getBearerToken } from "@/src/server/auth/headers";
import { verifyUserToken } from "@/src/server/auth/user-auth";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { approvePortalSession } from "@/src/server/portal-sessions";
import { ensureUser } from "@/src/server/user";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return jsonError("portal_not_found", "Portal session not found.", {
      status: 404,
    });
  }

  const token = getBearerToken(request.headers);
  const authUser = await verifyUserToken(token);
  if (!authUser) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const user = await ensureUser(authUser);
  if (!user) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const result = await approvePortalSession(id, user.id);
  if (!result.ok) {
    const code =
      result.reason === "expired" ? "portal_expired" : "portal_not_found";
    const message =
      result.reason === "expired"
        ? "Portal session expired."
        : "Portal session not found.";
    return jsonError(code, message, { status: 404 });
  }

  const approvedAt = result.session.approvedAt ?? new Date();
  return jsonNoStore({
    status: "approved",
    approvedAt: approvedAt.toISOString(),
  });
}
