import { redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/auth";
import { getUserById, ensurePublicUser } from "@/src/server/backend/user";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();
  let user = await getUserById(session.user.id, supabase);
  if (!user) {
    await ensurePublicUser(
      {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        imageUrl: session.user.imageUrl ?? null,
      },
      supabase,
    );
    user = await getUserById(session.user.id, supabase);
  }
  if (user?.onboardingSeenAt !== null && user?.onboardingSeenAt !== undefined) {
    redirect("/trails");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4 py-12">
      <OnboardingFlow userId={session.user.id} />
    </main>
  );
}
