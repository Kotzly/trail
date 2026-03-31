import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { getExtensionConfig } from "@/src/server/backend/extension-config";
import { jsonNoStore } from "@/src/server/backend/response";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { db } from "@trail/db";
import { maybeRow } from "@trail/db/helpers";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

export const runtime = "nodejs";

function typed<T>(res: unknown): PostgrestSingleResponse<T> {
  return res as PostgrestSingleResponse<T>;
}

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
    const record = maybeRow(
      typed<{ auth_session_version: number } | null>(
        await db
          .from("users")
          .select("auth_session_version")
          .eq("id", user.id)
          .maybeSingle(),
      ),
    );
    return jsonNoStore({
      status: "authenticated",
      source: "web",
      userId: user.id,
      authSessionVersion: record?.auth_session_version ?? null,
      ...getExtensionConfig(),
    });
  }

  return jsonNoStore({
    status: "guest",
    ...getExtensionConfig(),
  });
}
