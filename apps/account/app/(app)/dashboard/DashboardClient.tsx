"use client";

import Link from "next/link";
import { Badge, Button, Card } from "@trail/ui";
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
      <Card>
        <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Account</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-high text-sm font-semibold">
            {initials}
          </div>
          <div>
            <p className="text-sm font-semibold">{displayName}</p>
            <p className="text-xs text-ink-muted">{displayEmail}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="muted">Plan: Early access</Badge>
          <Badge tone="muted">Workspace: Trail</Badge>
        </div>
        <Button asChild size="sm" variant="outline" className="mt-4 w-full">
          <Link href="/settings">Manage settings</Link>
        </Button>
      </Card>

      <Card>
        <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">System</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">API status</p>
            <p className="mt-1 text-xs text-ink-muted">
              Live heartbeat from your Trail API.
            </p>
          </div>
          <Badge tone={health.data?.ok ? "default" : "muted"}>{systemStatus}</Badge>
        </div>
        {health.data?.timestamp ? (
          <p className="mt-3 text-xs text-ink-muted">
            Last check: {health.data.timestamp}
          </p>
        ) : null}
      </Card>

      <Card>
        <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Shortcuts</p>
        <div className="mt-4 grid gap-3">
          <Button asChild size="sm">
            <Link href="/extension">Connect extension</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/billing">Billing overview</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/settings">Workspace settings</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
