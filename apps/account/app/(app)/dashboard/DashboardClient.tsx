"use client";

import { trpc } from "@/src/trpc/client";

export function DashboardClient() {
  const health = trpc.health.useQuery();

  return (
    <div className="rounded-2xl border border-border/50 bg-surface/80 p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">System</p>
      <p className="mt-3 text-sm">
        API status: {health.data?.ok ? "Online" : "Checking..."}
      </p>
      {health.data?.timestamp ? (
        <p className="mt-1 text-xs text-ink-muted">{health.data.timestamp}</p>
      ) : null}
    </div>
  );
}
