import { redirect } from "next/navigation";
import {
  DesktopIcon,
  LaptopIcon,
  Link2Icon,
  LockClosedIcon
} from "@radix-ui/react-icons";
import { EmptyState, StatCard } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { auth0 } from "@/src/lib/auth0";
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

  const session = await auth0.getSession();
  if (!session?.user) {
    redirect(`/auth/login?${new URLSearchParams({ returnTo })}`);
  }

  const user = await ensureUser(session.user);
  if (!user) {
    redirect(`/auth/login?${new URLSearchParams({ returnTo })}`);
  }

  let connectionReady = false;

  if (queryCode) {
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
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-border/60 bg-surface/70 p-4">
          <div>
            <p className="text-xs text-ink-muted">{accountCopy.extension.status.eyebrow}</p>
            <p className="text-sm font-semibold text-ink">
              {accountCopy.extension.status.title}
            </p>
            <p className="text-xs text-ink-muted">
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
                  <a
                    href={accountCopy.extension.empty.ctaHref}
                    className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-xs font-semibold text-ink"
                  >
                    {accountCopy.extension.empty.cta}
                  </a>
                }
              />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-surface/70 p-4">
          <div>
            <p className="text-xs text-ink-muted">{accountCopy.extension.device.eyebrow}</p>
            <p className="text-sm font-semibold text-ink">
              {accountCopy.extension.device.title}
            </p>
            <p className="text-xs text-ink-muted">
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

      <div className="rounded-2xl border border-border/60 bg-surface/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-muted">{accountCopy.extension.sessions.eyebrow}</p>
            <p className="text-sm font-semibold text-ink">
              {accountCopy.extension.sessions.title}
            </p>
            <p className="text-xs text-ink-muted">
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
