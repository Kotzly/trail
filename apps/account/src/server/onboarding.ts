import "server-only";

import { getAuthSession } from "@/src/lib/auth";
import { getUserById } from "@/src/server/backend/user";

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

export async function getOnboardingState(): Promise<OnboardingState> {
  const session = await getAuthSession();
  if (!session?.user.id) {
    return PENDING_STATE;
  }

  const user = await getUserById(session.user.id).catch(() => null);
  if (!user?.onboardingSeenAt) {
    return PENDING_STATE;
  }

  return {
    flowId: "activation-v1",
    status: "completed",
    seenAt: user.onboardingSeenAt.toISOString(),
  };
}
