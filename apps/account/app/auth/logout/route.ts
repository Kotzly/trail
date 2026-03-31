import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { revokeAllExtensionSessionsForUser } from "@/src/server/backend/oauth";

export const runtime = "nodejs";

export async function GET() {
  return new NextResponse("Method Not Allowed. Use POST to log out.", {
    status: 405,
    headers: { Allow: "POST" },
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  // Resolve user for extension session revocation
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let userId = user?.id ?? null;

  // Fallback: try extension bearer token
  if (!userId) {
    const bearer = getBearerToken(request.headers);
    if (bearer) {
      const ext = await verifyExtensionToken(bearer);
      if (ext?.sub) userId = ext.sub;
    }
  }

  // Revoke extension sessions if user found
  if (userId) {
    await revokeAllExtensionSessionsForUser(userId).catch(() => undefined);
  }

  // Sign out from Supabase (clears cookies)
  await supabase.auth.signOut();

  return new NextResponse(null, { status: 204 });
}
