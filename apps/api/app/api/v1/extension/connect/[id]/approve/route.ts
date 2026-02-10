import { getBearerToken } from "@/src/server/auth/headers";
import { verifyExtensionToken } from "@/src/server/auth/extension-auth";
import { approveConnectSession } from "@/src/server/connect-sessions";
import { jsonError } from "@/src/server/error-response";
import { jsonNoStore } from "@/src/server/response";

export const runtime = "nodejs";

export async function POST(
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
  const extension = token ? verifyExtensionToken(token) : null;
  if (!extension) {
    return jsonError("unauthorized", "Unauthorized.", { status: 401 });
  }

  const result = await approveConnectSession(id, extension.sub);
  if (!result.ok) {
    const code =
      result.reason === "expired" ? "connect_expired" : "connect_not_found";
    const message =
      result.reason === "expired"
        ? "Connect session expired."
        : "Connect session not found.";
    return jsonError(code, message, { status: 404 });
  }

  const approvedAt = result.session.approvedAt ?? new Date();
  return jsonNoStore({
    status: "approved",
    approvedAt: approvedAt.toISOString(),
  });
}
