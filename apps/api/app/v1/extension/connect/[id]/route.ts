import { getBearerToken } from "@/src/server/auth/headers";
import { verifyUserToken } from "@/src/server/auth/user-auth";
import { getConnectSessionStatus } from "@/src/server/connect-sessions";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";
import { ensureUser } from "@/src/server/user";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return jsonError("connect_not_found", "Connect session not found.", {
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

  const result = await getConnectSessionStatus(id, user.id);
  if (!result) {
    return jsonError("connect_not_found", "Connect session not found.", {
      status: 404,
    });
  }

  if (result.status === "approved") {
    return jsonNoStore({
      status: "approved",
      approvedAt: result.session.approvedAt?.toISOString() ?? null,
    });
  }

  return jsonNoStore({ status: result.status });
}
