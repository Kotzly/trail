import { redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/auth";
import { getOnboardingState } from "@/src/server/onboarding";
import OnboardingGate from "./OnboardingGate";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/auth/callback");
  }

  const user = session.user;
  const onboarding = await getOnboardingState();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar
        user={{
          name: user.name,
          email: user.email,
          imageUrl: user.imageUrl ?? null,
        }}
      />

      {/* Mobile top spacing for hamburger */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-8">
          {children}
        </main>
      </div>

      <Toaster />

      {onboarding?.status === "pending" && (
        <OnboardingGate initialStatus="pending" />
      )}
    </div>
  );
}
