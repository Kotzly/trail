"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightIcon, LightningBoltIcon } from "@radix-ui/react-icons";
import { Button, PageHeader, WaitlistDialog, cn } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { trpc } from "@/src/trpc/client";

type PageMeta = {
  title: string;
  subtitle?: string;
  cta?:
    | { type: "link"; label: string; href: string }
    | { type: "waitlist"; label: string };
};

const pageMeta: Array<{ href: string; meta: PageMeta }> = [
  {
    href: "/dashboard",
    meta: {
      title: accountCopy.dashboard.title,
      subtitle: accountCopy.dashboard.subtitle,
      cta: { type: "link", label: accountCopy.dashboard.cta, href: "/extension" }
    }
  },
  {
    href: "/settings",
    meta: {
      title: accountCopy.settings.title,
      subtitle: accountCopy.settings.subtitle,
      cta: { type: "link", label: accountCopy.settings.cta, href: "/settings#profile" }
    }
  },
  {
    href: "/billing",
    meta: {
      title: accountCopy.billing.title,
      subtitle: accountCopy.billing.subtitle,
      cta: { type: "waitlist", label: accountCopy.billing.cta }
    }
  },
  {
    href: "/extension",
    meta: {
      title: accountCopy.extension.title,
      subtitle: accountCopy.extension.subtitle,
      cta: { type: "link", label: accountCopy.extension.cta, href: "/extension" }
    }
  }
];

export function TopBar() {
  const pathname = usePathname();
  const health = trpc.health.useQuery(undefined, { refetchInterval: 30000 });

  const active = pageMeta.find((item) => pathname.startsWith(item.href))?.meta ?? {
    title: "Account",
    subtitle: ""
  };

  const statusLabel = health.data?.ok ? "Sync ready" : "Sync checking";
  const statusTone = health.data?.ok ? "bg-emerald-500" : "bg-amber-400";

  const action = active.cta ? (
    active.cta.type === "waitlist" ? (
      <WaitlistDialog
        triggerLabel={active.cta.label}
        title={accountCopy.billing.waitlistTitle}
        description={accountCopy.billing.waitlistDialogDescription}
        source="billing"
        buttonVariant="primary"
      />
    ) : (
      <Button asChild size="md">
        <Link href={active.cta.href}>
          {active.cta.label}
          <ArrowRightIcon />
        </Link>
      </Button>
    )
  ) : null;

  return (
    <header className="rounded-3xl border border-border/60 bg-surface/80 px-6 py-5 shadow-card">
      <PageHeader
        className="border-b-0 pb-0"
        title={active.title}
        subtitle={active.subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-1 text-xs text-ink-muted">
              <span className={cn("h-2 w-2 rounded-full", statusTone)} />
              <span>{statusLabel}</span>
            </div>
            {action}
          </div>
        }
      >
        <nav className="flex items-center gap-2 text-xs text-ink-muted">
          <Link href="/dashboard" className="transition hover:text-ink">
            Account
          </Link>
          <span>/</span>
          <span className="text-ink">{active.title}</span>
          <span className="ml-3 inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface px-2 py-1 text-[0.65rem] font-medium text-ink-muted">
            <LightningBoltIcon className="h-3 w-3" />
            Early access
          </span>
        </nav>
      </PageHeader>
    </header>
  );
}
