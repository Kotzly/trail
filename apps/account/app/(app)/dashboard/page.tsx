import { accountCopy } from "@trail/content";
import { DashboardClient } from "./DashboardClient";

export default function DashboardPage() {
  const { dashboard } = accountCopy;

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{dashboard.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{dashboard.subtitle}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-border/50 bg-surface/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Trails</p>
          <p className="mt-4 text-sm text-ink-muted">{dashboard.emptyState}</p>
        </div>
        <DashboardClient />
      </div>
    </section>
  );
}
