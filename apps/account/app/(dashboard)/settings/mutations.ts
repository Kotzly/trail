"use server";

import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/src/lib/auth";
import { resetUserOnboarding } from "@/src/server/backend/user";

type ActionResult = { error?: string; success?: boolean };

export async function resetOnboarding(): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Unauthorized" };

  try {
    const ok = await resetUserOnboarding(session.user.id);
    if (!ok) return { error: "User not found" };
  } catch {
    return { error: "Failed to reset onboarding" };
  }

  revalidatePath("/settings");
  return { success: true };
}
