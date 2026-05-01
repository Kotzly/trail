import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { getExtensionConfig } from "@/src/server/backend/extension-config";
import { jsonOk, jsonFail } from "@/src/server/backend/error-response";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { db } from "@trail/db";
import { maybeRow } from "@trail/db/helpers";
import { rateLimit } from "@/src/server/api/rate-limit";
import { corsHeaders, optionsResponse } from "@/src/server/api/cors";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

export const runtime = "nodejs";

function typed<T>(res: unknown): PostgrestSingleResponse<T> {
  return res as PostgrestSingleResponse<T>;
}

export function OPTIONS(request: Request) {
  return optionsResponse(request);
}

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(ip, "default");
  if (!rl.ok) {
    return jsonFail("RATE_LIMITED", "Too many requests", { status: 429 });
  }

  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  // 1. Check bearer token (extension)
  const bearer = getBearerToken(request.headers);
  if (bearer) {
    const extension = await verifyExtensionToken(bearer);
    if (extension?.sub) {
      return jsonOk({
        status: "authenticated",
        source: "extension",
        userId: extension.sub,
        sessionId: extension.sid ?? null,
        authSessionVersion: extension.ver ?? null,
        ...getExtensionConfig(),
      }, { headers: cors });
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
    return jsonOk({
      status: "authenticated",
      source: "web",
      userId: user.id,
      authSessionVersion: record?.auth_session_version ?? null,
      ...getExtensionConfig(),
    }, { headers: cors });
  }

  return jsonOk({
    status: "guest",
    ...getExtensionConfig(),
  }, { headers: cors });
}
