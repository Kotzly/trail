import { NextResponse } from "next/server";
import { getAuthSession } from "@/src/lib/auth";
import { getUserById, markUserOnboardingSeen, ensurePublicUser } from "@/src/server/backend/user";
import { buildOnboardingState } from "@/src/server/onboarding";
import { db } from "@trail/db";

export const runtime = "nodejs";

function json(data: object, opts?: { status?: number }) {
  return NextResponse.json(data, {
    status: opts?.status ?? 200,
    headers: { "Cache-Control": "no-store" },
  });
}

const PENDING = {
  onboarding: { flowId: "activation-v1" as const, status: "pending" as const, seenAt: null },
};

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user.id) {
    return json(PENDING, { status: 401 });
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    return json(PENDING);
  }

  return json({ onboarding: buildOnboardingState(user.onboardingSeenAt) });
}

export async function POST() {
  const session = await getAuthSession();
  if (!session?.user.id) {
    return json(PENDING, { status: 401 });
  }

  const userId = session.user.id;

  // 1. Ensure user row exists (DB trigger race condition safety-net)
  await ensurePublicUser({
    id: userId,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    imageUrl: session.user.imageUrl ?? null,
  }).catch(() => {});

  // 2. Try the standard mark function
  try {
    const seenAt = await markUserOnboardingSeen(userId);
    if (seenAt) {
      return json({ onboarding: buildOnboardingState(seenAt) });
    }
  } catch {
    // singleRow may throw if .single() returns 0 rows — fall through to direct update
  }

  // 3. Fallback: direct update with null guard (never overwrite existing value)
  const now = new Date().toISOString();
  await db
    .from("users")
    .update({ onboarding_seen_at: now, updated_at: now })
    .eq("id", userId)
    .is("onboarding_seen_at", null);

  // Read actual stored value (may differ if concurrent POST already wrote)
  const { data: row } = await db
    .from("users")
    .select("onboarding_seen_at")
    .eq("id", userId)
    .single();

  return json({ onboarding: buildOnboardingState(row?.onboarding_seen_at ?? now) });
}
