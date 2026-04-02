"use server";

import { markUserOnboardingSeen } from "@/src/server/backend/user";
import { getAuthSession } from "@/src/lib/auth";

export async function completeOnboarding(): Promise<{
  error?: string;
  success?: boolean;
}> {
  const session = await getAuthSession();
  if (!session) return { error: "Unauthorized" };

  const result = await markUserOnboardingSeen(session.user.id);
  if (!result) return { error: "Failed to complete onboarding" };

  return { success: true };
}
