"use client";

import Link from "next/link";
import { Badge } from "@trail/ui";
import { trpc } from "@/src/trpc/client";

export function DashboardClient() {
  const health = trpc.health.useQuery();
  const me = trpc.me.useQuery();

  const user = me.data?.user ?? null;
  const displayName =
    user?.name?.trim() || user?.email?.split("@")[0] || "Trail member";
  const displayEmail = user?.email || "Signed in";
  const initialsSource = user?.name || user?.email || "Trail";
  const initials = initialsSource
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join("");
  const systemStatus = health.data?.ok ? "Online" : "Checking";

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-subtle">Account</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-sm font-semibold text-surface">
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{displayName}</p>
            <p className="text-xs text-ink-subtle">{displayEmail}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="bg-surface-strong text-xs font-semibold text-ink">Early access</Badge>
          <Badge className="bg-surface-strong text-xs font-semibold text-ink">Solo workspace</Badge>
        </div>
        <Link
          href="/settings"
          className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-stroke/60 px-4 py-2 text-sm font-semibold text-ink transition hover:border-stroke"
        >
          Manage settings
        </Link>
      </div>

      <div className="rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-subtle">System</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">API status</p>
            <p className="mt-1 text-xs text-ink-subtle">Live heartbeat from your Trail API.</p>
          </div>
          <Badge
            className={
              health.data?.ok
                ? "bg-surface-strong text-xs font-semibold text-ink"
                : "bg-surface-strong text-xs font-semibold text-ink-muted"
            }
          >
            {systemStatus}
          </Badge>
        </div>
        {health.data?.timestamp ? (
          <p className="mt-3 text-xs text-ink-subtle">Last check: {health.data.timestamp}</p>
        ) : null}
      </div>

      <div className="rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-subtle">Quick links</p>
        <div className="mt-4 grid gap-3 text-sm font-semibold">
          <Link
            href="/extension"
            className="inline-flex items-center justify-between rounded-2xl border border-stroke/40 bg-surface/80 px-4 py-3 text-ink transition hover:border-stroke"
          >
            <span>Connect extension</span>
            <span>→</span>
          </Link>
          <Link
            href="/billing"
            className="inline-flex items-center justify-between rounded-2xl border border-stroke/40 bg-surface/80 px-4 py-3 text-ink transition hover:border-stroke"
          >
            <span>Billing overview</span>
            <span>→</span>
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center justify-between rounded-2xl border border-stroke/40 bg-surface/80 px-4 py-3 text-ink transition hover:border-stroke"
          >
            <span>Workspace settings</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
