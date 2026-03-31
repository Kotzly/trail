import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { getExtensionConfig } from "@/src/server/backend/extension-config";
import { jsonNoStore } from "@/src/server/backend/response";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { db } from "@trail/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // 1. Check bearer token (extension)
  const bearer = getBearerToken(request.headers);
  if (bearer) {
    const extension = await verifyExtensionToken(bearer);
    if (extension?.sub) {
      return jsonNoStore({
        status: "authenticated",
        source: "extension",
        userId: extension.sub,
        sessionId: extension.sid ?? null,
        authSessionVersion: extension.ver ?? null,
        ...getExtensionConfig(),
      });
    }
  }

  // 2. Check Supabase cookie session (web)
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const record = await db.user.findUnique({
      where: { id: user.id },
      select: { authSessionVersion: true },
    });
    return jsonNoStore({
      status: "authenticated",
      source: "web",
      userId: user.id,
      authSessionVersion: record?.authSessionVersion ?? null,
      ...getExtensionConfig(),
    });
  }

  return jsonNoStore({
    status: "guest",
    ...getExtensionConfig(),
  });
}
