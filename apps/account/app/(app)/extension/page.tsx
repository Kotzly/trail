import { redirect } from "next/navigation";
import { DesktopIcon, LaptopIcon, Link2Icon, LockClosedIcon } from "@radix-ui/react-icons";
import { Button, EmptyState, StatCard } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { PageHeader } from "@/app/components/PageHeader";
import { getAuthSession } from "@/src/lib/auth";
import { ensureUser } from "@/src/server/user";
import { createExtensionLoginCode } from "@/src/server/extension-login";

export const runtime = "nodejs";

type ExtensionPageProps = {
  searchParams: Promise<{
    code?: string;
  }>;
};

type ExtensionSession = {
  id: string;
  device: string;
  location: string;
  lastSeen: string;
  status: string;
};

export default async function ExtensionPage({ searchParams }: ExtensionPageProps) {
  const resolvedSearchParams = await searchParams;
  const queryCode =
    typeof resolvedSearchParams?.code === "string" ? resolvedSearchParams.code : null;
  const returnTo = queryCode ? `/extension?code=${queryCode}` : "/extension";
  const session = await getAuthSession();

  if (!session?.user) {
    redirect(`/auth/login?${new URLSearchParams({ returnTo })}`);
  }

  const user = session.user ? await ensureUser(session.user) : null;
  if (!user) {
    redirect(`/auth/login?${new URLSearchParams({ returnTo })}`);
  }

  let connectionReady = false;

  if (queryCode && user) {
    try {
      const stored = await createExtensionLoginCode(user.id, queryCode);
      if (stored !== queryCode) {
        redirect(`/extension?code=${stored}`);
      }
      connectionReady = true;
    } catch {
      const newCode = await createExtensionLoginCode(user.id);
      redirect(`/extension?code=${newCode}`);
    }
  }

  const sessions: ExtensionSession[] = [];

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow={accountCopy.nav.extension}
        title={accountCopy.extension.title}
        subtitle={accountCopy.extension.subtitle}
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {accountCopy.extension.status.eyebrow}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {accountCopy.extension.status.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {accountCopy.extension.status.subtitle}
            </p>
          </div>
          <div className="mt-4">
            {connectionReady ? (
              <div className="grid gap-3 md:grid-cols-2">
                <StatCard
                  label={accountCopy.extension.connected.stats.status}
                  value={accountCopy.extension.connected.stats.value}
                  caption={accountCopy.extension.connected.stats.caption}
                  icon={<Link2Icon className="h-4 w-4" />}
                />
                <StatCard
                  label={accountCopy.extension.connected.stats.permissions}
                  value={accountCopy.extension.connected.stats.permissionsValue}
                  caption={accountCopy.extension.connected.stats.permissionsCaption}
                  icon={<LockClosedIcon className="h-4 w-4" />}
                />
              </div>
            ) : (
              <EmptyState
                title={accountCopy.extension.empty.title}
                description={accountCopy.extension.empty.description}
                icon={<LaptopIcon className="h-5 w-5" />}
                items={accountCopy.extension.empty.items}
                className="rounded-none border-0 bg-transparent p-0"
                action={
                  <Button.AsChild size="sm" className="rounded-full bg-cta text-cta-fg hover:bg-cta-hover">
                    <a href={accountCopy.extension.empty.ctaHref}>
                      {accountCopy.extension.empty.cta}
                    </a>
                  </Button.AsChild>
                }
              />
            )}
          </div>
        </div>

        <div className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {accountCopy.extension.device.eyebrow}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {accountCopy.extension.device.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {accountCopy.extension.device.subtitle}
            </p>
          </div>
          <div className="mt-4 grid gap-3">
            <StatCard
              label={accountCopy.extension.device.primaryDevice}
              value={connectionReady ? accountCopy.extension.device.connected : "—"}
              caption={accountCopy.extension.device.primaryDeviceCaption}
              icon={<DesktopIcon className="h-4 w-4" />}
            />
            <StatCard
              label={accountCopy.extension.device.lastSeen}
              value={connectionReady ? accountCopy.extension.device.lastSeenValue : "—"}
              caption={accountCopy.extension.device.lastSeenCaption}
              icon={<LaptopIcon className="h-4 w-4" />}
            />
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {accountCopy.extension.sessions.eyebrow}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {accountCopy.extension.sessions.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {accountCopy.extension.sessions.subtitle}
            </p>
          </div>
          <span className="trail-status">{accountCopy.extension.sessions.comingSoon}</span>
        </div>
        {sessions.length ? (
          <div className="mt-4 divide-y divide-border/40">
            {sessions.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{item.device}</p>
                  <p className="text-xs text-ink-muted">{item.location}</p>
                </div>
                <span className="trail-status">{item.lastSeen}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 border-t border-border/40 pt-3 text-xs text-ink-muted">
            {accountCopy.extension.sessions.empty}
          </div>
        )}
      </div>
    </section>
  );
}
