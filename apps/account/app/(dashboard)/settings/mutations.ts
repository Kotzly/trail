"use server";

import { revalidatePath } from "next/cache";
import { getAuthSession } from "@/src/lib/auth";
import { resetUserOnboarding } from "@/src/server/backend/user";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

type ActionResult = { error?: string; success?: boolean };

export async function resetOnboarding(): Promise<ActionResult> {
  const session = await getAuthSession();
  if (!session) return { error: "Unauthorized" };

  try {
    const supabase = await createSupabaseServerClient();
    const ok = await resetUserOnboarding(session.user.id, supabase);
    if (!ok) return { error: "User not found" };
  } catch {
    return { error: "Failed to reset onboarding" };
  }

  revalidatePath("/settings");
  return { success: true };
}
