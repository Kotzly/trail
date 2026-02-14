import "server-only";

import { getAuthSession } from "@/src/lib/auth";
import { internalApiJson } from "@/src/server/internal-api";

type OnboardingState = {
  flowId: "activation-v1";
  status: "pending" | "completed";
  seenAt: string | null;
};

const PENDING_STATE: OnboardingState = {
  flowId: "activation-v1",
  status: "pending",
  seenAt: null,
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
  return PENDING_STATE;
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const session = await getAuthSession();
  if (!session?.user.id) {
    return PENDING_STATE;
  }

  try {
    const payload = await internalApiJson<InternalOnboardingResponse>(
      `/api/internal/users/${encodeURIComponent(session.user.id)}/onboarding`,
      { method: "GET" },
    );
    return toOnboardingState(payload);
  } catch {
    return PENDING_STATE;
  }
}
