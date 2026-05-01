import "server-only";

import { getAuthSession } from "@/src/lib/auth";
import { getUserById } from "@/src/server/backend/user";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type OnboardingState = {
  flowId: "activation-v1";
  status: "pending" | "completed";
  seenAt: string | null;
};

export function buildOnboardingState(
  seenAt: Date | string | null,
): OnboardingState {
  if (seenAt) {
    return {
      flowId: "activation-v1",
      status: "completed",
      seenAt: seenAt instanceof Date ? seenAt.toISOString() : seenAt,
    };
  }
  return { flowId: "activation-v1", status: "pending", seenAt: null };
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const session = await getAuthSession();
  if (!session?.user.id) {
    return buildOnboardingState(null);
  }

  const supabase = await createSupabaseServerClient();
  const user = await getUserById(session.user.id, supabase).catch(() => null);
  if (!user?.onboardingSeenAt) {
    return buildOnboardingState(null);
  }

  return buildOnboardingState(user.onboardingSeenAt);
}
