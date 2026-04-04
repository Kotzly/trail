import { redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/auth";
import { getUserById, ensurePublicUser } from "@/src/server/backend/user";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
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
  if (user && !user.onboardingSeenAt) {
    redirect("/onboarding");
  }

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset>
        <div className="flex flex-1 flex-col p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
