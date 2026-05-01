import {
  type ExtensionTokenPayload,
  verifySignedExtensionToken,
} from "@trail/auth-token";
import { db } from "@trail/db";
import { maybeRow } from "@trail/db/helpers";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { env } from "@/src/env";

function typed<T>(res: unknown): PostgrestSingleResponse<T> {
  return res as PostgrestSingleResponse<T>;
}

export async function verifyExtensionToken(
  token: string,
): Promise<ExtensionTokenPayload | null> {
  const payload = verifySignedExtensionToken(
    env.TRAIL_EXTENSION_JWT_SECRET,
    token,
  );
  if (!payload?.sub) {
    return null;
  }
  if (!payload.sid || typeof payload.ver !== "number") {
    return null;
  }

  const [user, session] = await Promise.all([
    maybeRow(
      typed<{ id: string; auth_session_version: number } | null>(
        await db
          .from("users")
          .select("id, auth_session_version")
          .eq("id", payload.sub)
          .maybeSingle(),
      ),
    ),
    maybeRow(
      typed<{
        id: string;
        user_id: string;
        status: string;
        revoked_at: string | null;
      } | null>(
        await db
          .from("extension_device_sessions")
          .select("id, user_id, status, revoked_at")
          .eq("id", payload.sid)
          .maybeSingle(),
      ),
    ),
  ]);

  if (!user || !session) {
    return null;
  }
  if (session.user_id !== payload.sub) {
    return null;
  }
  if (session.status !== "ACTIVE" || session.revoked_at) {
    return null;
  }
  if (user.auth_session_version !== payload.ver) {
    return null;
  }

  void Promise.resolve(
    db
      .from("extension_device_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", session.id),
  ).catch(() => undefined);

  return payload;
}
