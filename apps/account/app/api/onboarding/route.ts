import { NextResponse } from "next/server";
import { getAuthSession } from "@/src/lib/auth";
import { getUserById, markUserOnboardingSeen } from "@/src/server/backend/user";

export const runtime = "nodejs";

type OnboardingState = {
  flowId: "activation-v1";
  status: "pending" | "completed";
  seenAt: string | null;
};

function toOnboardingState(seenAt: Date | string | null): OnboardingState {
  if (seenAt) {
    return {
      flowId: "activation-v1",
      status: "completed",
      seenAt: seenAt instanceof Date ? seenAt.toISOString() : seenAt,
    };
  }
  return { flowId: "activation-v1", status: "pending", seenAt: null };
}

function unauthorized() {
  return NextResponse.json(
    { onboarding: { flowId: "activation-v1", status: "pending", seenAt: null } },
    { status: 401 },
  );
}

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user.id) {
    return unauthorized();
  }

  const user = await getUserById(session.user.id).catch(() => null);
  if (!user) {
    return NextResponse.json(
      { onboarding: { flowId: "activation-v1", status: "pending", seenAt: null } },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { onboarding: toOnboardingState(user.onboardingSeenAt) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST() {
  const session = await getAuthSession();
  if (!session?.user.id) {
    return unauthorized();
  }

  const seenAt = await markUserOnboardingSeen(session.user.id).catch(() => null);
  if (seenAt === null) {
    return NextResponse.json(
      { onboarding: { flowId: "activation-v1", status: "pending", seenAt: null } },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { onboarding: toOnboardingState(seenAt) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
