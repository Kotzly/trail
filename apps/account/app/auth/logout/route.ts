import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getBearerToken } from "@/src/server/backend/auth/headers";
import { verifyExtensionToken } from "@/src/server/backend/auth/extension-auth";
import { revokeAllExtensionSessionsForUser } from "@/src/server/backend/oauth";

export const runtime = "nodejs";

const ALLOWED_LOGOUT_ORIGINS = [process.env.NEXT_PUBLIC_APP_URL].filter(
  Boolean,
) as string[];

export async function GET() {
  return new NextResponse("Method Not Allowed. Use POST to log out.", {
    status: 405,
    headers: { Allow: "POST" },
  });
}

export async function POST(request: Request) {
  const bearer = getBearerToken(request.headers);

  // Route 1 — extension bearer path. Cryptographically authenticated
  // via HMAC-signed JWT; no CSRF concern (extension origin attaches
  // Authorization header that a foreign site can't forge).
  if (bearer) {
    const ext = await verifyExtensionToken(bearer);
    if (!ext?.sub) {
      return NextResponse.json({ error: "invalid_bearer" }, { status: 401 });
    }
    await revokeAllExtensionSessionsForUser(ext.sub).catch(() => undefined);
    // Don't call supabase.auth.signOut() here — we don't have a cookie
    // session for this path.
    return new NextResponse(null, { status: 204 });
  }

  // Route 2 — browser cookie-session path. Requires origin/referer
  // match to prevent a cross-site form-post from signing the user
  // out. @supabase/ssr cookies are SameSite=Lax by default (we also
  // pin it explicitly in middleware), so a bare form POST from
  // evil.com can't send the session cookie — but belt-and-suspenders
  // matters here because the cost of mis-logout is low but annoying
  // (closes P1.4).
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const originOk = origin ? ALLOWED_LOGOUT_ORIGINS.includes(origin) : false;
  let refererOk = false;
  if (referer) {
    try {
      refererOk = ALLOWED_LOGOUT_ORIGINS.includes(new URL(referer).origin);
    } catch {
      refererOk = false;
    }
  }
  if (!originOk && !refererOk) {
    return NextResponse.json(
      { error: "csrf_origin_mismatch" },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await revokeAllExtensionSessionsForUser(user.id).catch(() => undefined);
  }
  await supabase.auth.signOut();

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) {
    return new NextResponse(null, { status: 204 });
  }

  const baseUrl = new URL(request.url).origin;
  return NextResponse.redirect(new URL("/login", baseUrl), 303);
}
