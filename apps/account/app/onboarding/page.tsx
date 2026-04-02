import { redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/auth";
import { getOnboardingState } from "@/src/server/onboarding";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/auth/callback");
  }

  const onboarding = await getOnboardingState();
  if (onboarding.status === "completed") {
    redirect("/trails");
  }

  return <OnboardingFlow />;
}
