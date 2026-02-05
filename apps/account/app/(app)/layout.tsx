import { AppShell } from "../components/AppShell";
import { OnboardingModal } from "../components/OnboardingModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      {children}
      <OnboardingModal />
    </AppShell>
  );
}
