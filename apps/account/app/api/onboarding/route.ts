import { NextResponse } from "next/server";
import { getAuthSession } from "@/src/lib/auth";
import { internalApiJson } from "@/src/server/internal-api";

export const runtime = "nodejs";

type OnboardingState = {
  flowId: "activation-v1";
  status: "pending" | "completed";
  seenAt: string | null;
};

type InternalOnboardingResponse = {
  seen: boolean;
  seenAt?: string | null;
};

function toOnboardingState(resp: InternalOnboardingResponse): OnboardingState {
  if (resp.seen) {
    return {
      flowId: "activation-v1",
      status: "completed",
      seenAt: resp.seenAt ?? new Date().toISOString(),
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

  try {
    const payload = await internalApiJson<InternalOnboardingResponse>(
      `/api/internal/users/${encodeURIComponent(session.user.id)}/onboarding`,
      { method: "GET" },
    );

    return NextResponse.json(
      { onboarding: toOnboardingState(payload) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { onboarding: { flowId: "activation-v1", status: "pending", seenAt: null } },
      { status: 500 },
    );
  }
}

export async function POST() {
  const session = await getAuthSession();
  if (!session?.user.id) {
    return unauthorized();
  }

  try {
    const payload = await internalApiJson<InternalOnboardingResponse>(
      `/api/internal/users/${encodeURIComponent(session.user.id)}/onboarding`,
      { method: "POST" },
    );

    return NextResponse.json(
      { onboarding: toOnboardingState(payload) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { onboarding: { flowId: "activation-v1", status: "pending", seenAt: null } },
      { status: 500 },
    );
  }
}
