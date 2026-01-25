import Link from "next/link";
import { accountCopy } from "@trail/content";
import { BackgroundArt, Button, Card } from "@trail/ui";
import { auth0 } from "@/src/lib/auth0";

export default async function AccountHome() {
  const session = await auth0.getSession();
  const { home } = accountCopy;

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-20">
      <BackgroundArt variant="signal" />
      <div className="mx-auto max-w-4xl">
        <Card className="bg-surface/85 p-10">
          <h1 className="text-4xl font-semibold tracking-tight">{home.title}</h1>
          <p className="mt-4 max-w-2xl text-base text-ink-muted">{home.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {session ? (
              <Button asChild size="lg">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <a href="/auth/login">{home.primaryCta}</a>
              </Button>
            )}
            <Button asChild variant="outline" size="lg">
              <Link href="https://gettrail.net">Back to landing</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
