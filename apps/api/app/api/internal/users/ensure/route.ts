import { NextResponse } from "next/server";
import { ensureUser, type Auth0User } from "@/src/server/user";
import { requireInternalKey } from "@/src/server/internal-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = requireInternalKey(request.headers);
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const authUser = body?.user as Auth0User | undefined;

  if (!authUser) {
    return NextResponse.json({ user: null });
  }

  const user = await ensureUser(authUser);
  return NextResponse.json({ user });
}
