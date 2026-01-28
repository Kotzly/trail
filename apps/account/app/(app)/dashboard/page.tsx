import Link from "next/link";
import { accountCopy } from "@trail/content";
import { Badge } from "@trail/ui";
import { DashboardClient } from "./DashboardClient";

export default function DashboardPage() {
  const { dashboard } = accountCopy;

  return (
    <section className="space-y-10">
      <div className="trail-card relative overflow-hidden p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 top-10 h-32 w-32 rounded-full bg-ink/5 blur-3xl" />
          <div className="absolute -right-10 top-20 h-40 w-40 rounded-full bg-ink/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-ink/5 blur-3xl" />
        </div>
        <div className="relative space-y-6">
          <Badge className="border border-stroke/40 bg-surface/70 text-[10px] font-semibold uppercase tracking-[0.3em] text-ink-subtle">
            Workspace
          </Badge>
          <div>
            <h1 className="trail-title">{dashboard.title}</h1>
            <p className="trail-copy mt-2 max-w-2xl md:text-[1rem]">{dashboard.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/extension"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-surface shadow-card transition hover:bg-ink-muted"
            >
              {accountCopy.extension.action}
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-full border border-stroke/60 px-5 py-2 text-sm font-semibold text-ink transition hover:border-stroke"
            >
              Account settings
            </Link>
            <Link
              href="/billing"
              className="inline-flex items-center gap-2 rounded-full border border-stroke/40 bg-surface/80 px-5 py-2 text-sm font-semibold text-ink transition hover:border-stroke"
            >
              {accountCopy.nav.billing}
            </Link>
          </div>
          <div className="trail-card-compact p-4">
            <p className="trail-eyebrow">Next up</p>
            <p className="mt-3 text-sm font-semibold text-ink">Connect the extension</p>
            <p className="trail-copy mt-2 text-xs">
              Approve the connection to start syncing trails into your dashboard.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="trail-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="trail-eyebrow">Trails</p>
                <h2 className="mt-2 font-display text-xl font-semibold text-ink">
                  Recent activity
                </h2>
                <p className="trail-copy mt-2">{dashboard.emptyState}</p>
              </div>
              <Badge className="bg-surface-strong text-xs font-semibold text-ink">
                0 synced
              </Badge>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {["First trail", "Recent highlight"].map((label) => (
                <div
                  key={label}
                  className="trail-card-compact p-4"
                >
                  <p className="trail-eyebrow">{label}</p>
                  <p className="trail-copy mt-3">
                    Waiting for your extension to sync.
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="trail-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="trail-eyebrow">Getting started</p>
                <h2 className="mt-2 font-display text-xl font-semibold text-ink">
                  Your setup checklist
                </h2>
                <p className="trail-copy mt-2">Finish the essentials to unlock your first trail.</p>
              </div>
              <span className="rounded-full border border-stroke/40 bg-surface/70 px-3 py-1 text-xs font-semibold text-ink">
                Start here
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {[
                {
                  step: "1",
                  title: "Connect extension",
                  copy: "Open the extension and sign in to link your account.",
                  cta: "/extension",
                  ctaLabel: "Open extension"
                },
                {
                  step: "2",
                  title: "Capture a flow",
                  copy: "Record your first trail to populate the activity panel.",
                  cta: "/extension",
                  ctaLabel: "See tips"
                },
                {
                  step: "3",
                  title: "Review + share",
                  copy: "Organize trails and prepare to invite collaborators.",
                  cta: "/settings",
                  ctaLabel: "Manage account"
                }
              ].map((item) => (
                <div
                  key={item.step}
                  className="trail-card-compact flex flex-wrap items-center justify-between gap-4 px-4 py-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-surface">
                      {item.step}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="trail-copy mt-1 text-xs">{item.copy}</p>
                    </div>
                  </div>
                  <Link
                    href={item.cta}
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-ink"
                  >
                    {item.ctaLabel}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DashboardClient />
      </div>
    </section>
  );
}
