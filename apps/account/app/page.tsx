import { redirect } from "next/navigation";
import { accountCopy } from "@trail/content";
import { BackgroundArt, Button, Card } from "@trail/ui";
import { auth0 } from "@/src/lib/auth0";

export default async function AccountHome() {
  const session = await auth0.getSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  const { home } = accountCopy;

  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-20">
      <BackgroundArt variant="signal" />
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-10">
            <div className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-surface/80 px-4 py-2 text-xs uppercase tracking-[0.3em] text-ink-muted">
              <span className="text-ink">Trail</span>
              <span>{home.eyebrow}</span>
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-ink md:text-5xl">
                {home.title}
              </h1>
              <p className="mt-4 max-w-2xl text-[1rem] text-ink-muted">
                {home.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href="/auth/login">{home.primaryCta}</a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="https://gettrail.net">{home.secondaryCta}</a>
                </Button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {home.highlights.map((item) => (
                <Card key={item.title} className="border border-border/40 bg-surface/80 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-ink-subtle">
                    {item.title}
                  </p>
                  <p className="mt-3 text-sm text-ink">{item.copy}</p>
                </Card>
              ))}
            </div>
          </div>

          <Card className="border border-border/40 bg-surface/85 p-8 shadow-elev-2">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-subtle">How it works</p>
            <div className="mt-6 space-y-4">
              {home.steps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex items-start gap-4 rounded-2xl border border-border/40 bg-surface/90 px-4 py-4"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-surface">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{step.title}</p>
                    <p className="mt-1 text-xs text-ink-subtle">{step.copy}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-border/40 bg-surface/90 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-ink-subtle">
                Already signed in?
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                Open the extension to capture a trail and it will appear here automatically.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
