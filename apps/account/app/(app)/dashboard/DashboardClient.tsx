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
      <div className="trail-card p-6">
        <p className="trail-eyebrow">Account</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-sm font-semibold text-surface">
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{displayName}</p>
            <p className="trail-copy text-xs">{displayEmail}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-xs text-ink-subtle">
          <div className="flex items-center justify-between">
            <span>Workspace</span>
            <span className="text-ink">Solo</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Plan</span>
            <span className="text-ink">Early access</span>
          </div>
        </div>
        <Link
          href="/settings"
          className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-stroke/60 px-4 py-2 text-sm font-semibold text-ink transition hover:border-stroke"
        >
          Account settings
        </Link>
      </div>

      <div className="trail-card p-6">
        <p className="trail-eyebrow">System</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">API status</p>
            <p className="trail-copy mt-1 text-xs">Live heartbeat from your Trail API.</p>
          </div>
          <Badge className="bg-surface-strong text-xs font-semibold text-ink">
            {systemStatus}
          </Badge>
        </div>
        {health.data?.timestamp ? (
          <p className="trail-copy mt-3 text-xs">Last check: {health.data.timestamp}</p>
        ) : null}
      </div>

      <div className="trail-card p-6">
        <p className="trail-eyebrow">Quick links</p>
        <div className="mt-4 grid gap-3 text-sm font-semibold">
          <Link
            href="/extension"
            className="trail-card-compact inline-flex items-center justify-between px-4 py-3 text-ink transition hover:border-stroke"
          >
            <span>Open extension</span>
            <span>→</span>
          </Link>
          <Link
            href="/billing"
            className="trail-card-compact inline-flex items-center justify-between px-4 py-3 text-ink transition hover:border-stroke"
          >
            <span>Billing overview</span>
            <span>→</span>
          </Link>
          <Link
            href="/settings"
            className="trail-card-compact inline-flex items-center justify-between px-4 py-3 text-ink transition hover:border-stroke"
          >
            <span>Account settings</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
