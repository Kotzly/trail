import Link from "next/link";
import { getAuthSession } from "@/src/lib/auth";
import { getOnboardingState } from "@/src/server/onboarding";
import { Button } from "@/components/ui/button";
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
  const user = session?.user ?? null;
  const onboarding = user ? await getOnboardingState() : null;

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
            {user ? (
              <SignOutButton />
            ) : (
              <Button asChild size="sm">
                <a href="/auth/login">sign in</a>
              </Button>
            )}
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
