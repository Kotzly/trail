import { redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/auth";
import { getUserById } from "@/src/server/backend/user";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  if (!session) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (user && !user.onboardingSeenAt) {
    redirect("/onboarding");
  }

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
