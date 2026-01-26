import Link from "next/link";
import { accountCopy } from "@trail/content";
import { BackgroundArt, Badge, Button, Card } from "@trail/ui";
import { DashboardClient } from "./DashboardClient";

export default function DashboardPage() {
  const { dashboard } = accountCopy;

  return (
    <section className="space-y-10">
      <Card className="relative overflow-hidden p-8">
        <BackgroundArt variant="graph" className="opacity-70" />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Badge tone="muted" className="w-fit text-[10px] uppercase tracking-[0.3em]">
              Workspace
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {dashboard.title}
            </h1>
            <p className="max-w-2xl text-sm text-ink-muted md:text-base">
              {dashboard.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/extension">{accountCopy.extension.action}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings">{accountCopy.nav.settings}</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/billing">{accountCopy.nav.billing}</Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                label: "Step 1",
                title: "Connect the extension",
                description: "Generate a one-time code and sign in to start syncing trails."
              },
              {
                label: "Step 2",
                title: "Review your first trail",
                description: "See captured steps appear here as soon as the extension syncs."
              },
              {
                label: "Step 3",
                title: "Shape your workspace",
                description: "Tune settings and prepare billing before inviting teammates."
              }
            ].map((step) => (
              <div
                key={step.label}
                className="rounded-2xl border border-border/50 bg-surface/80 p-4 shadow-elev-1"
              >
                <p className="text-[10px] uppercase tracking-[0.3em] text-ink-muted">
                  {step.label}
                </p>
                <p className="mt-3 text-sm font-semibold">{step.title}</p>
                <p className="mt-2 text-xs text-ink-muted">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[2.1fr_1fr]">
        <div className="space-y-6">
          <Card className="relative overflow-hidden">
            <BackgroundArt variant="signal" className="opacity-60" />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Trails</p>
                  <h2 className="mt-2 text-lg font-semibold">Recent activity</h2>
                  <p className="mt-2 text-sm text-ink-muted">{dashboard.emptyState}</p>
                </div>
                <Badge tone="muted">0 synced</Badge>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {["First capture", "Session replay"].map((label) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-border/50 bg-surface-low/80 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">{label}</p>
                    <p className="mt-3 text-sm text-ink-muted">
                      Waiting for your extension to sync.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Focus</p>
            <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div>
                <h3 className="text-lg font-semibold">Unlock your workflow</h3>
                <p className="mt-2 text-sm text-ink-muted">
                  Trail starts with the browser extension. Once connected, you will see
                  timestamps, trails, and team-ready handoffs right here.
                </p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-surface-low/80 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">
                  Next action
                </p>
                <p className="mt-3 text-sm font-semibold">Connect extension</p>
                <p className="mt-2 text-xs text-ink-muted">
                  Generate a code and paste it in the extension to begin syncing.
                </p>
                <Button asChild size="sm" className="mt-4 w-full">
                  <Link href="/extension">{accountCopy.extension.action}</Link>
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <DashboardClient />
      </div>
    </section>
  );
}
