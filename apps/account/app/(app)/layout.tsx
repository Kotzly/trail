import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/auth";
import { getOnboardingState } from "@/src/server/onboarding";
import OnboardingGate from "./OnboardingGate";
import SignOutButton from "./SignOutButton";

const nav = [
  { href: "/trails", label: "trails" },
];

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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
          <Link href="/trails" className="text-sm font-semibold">
            trail
          </Link>

          <nav className="flex items-center gap-4">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-8">{children}</main>

      {onboarding?.status === "pending" && (
        <OnboardingGate initialStatus="pending" />
      )}
    </div>
  );
}
