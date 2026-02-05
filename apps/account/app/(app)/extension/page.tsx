import { redirect } from "next/navigation";
import {
  DesktopIcon,
  LaptopIcon,
  Link2Icon,
  LockClosedIcon,
} from "@radix-ui/react-icons";
import { Button, Card, EmptyState, SectionHeader, StatCard } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { PageHeader } from "@trail/ui";
import { getAuthSession } from "@/src/lib/auth";
import { ensureUser } from "@/src/server/user";
import { createExtensionLoginCode } from "@/src/server/extension-login";
import { ExtensionConnectionGuideClient } from "./ExtensionConnectionGuideClient";

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

export default async function ExtensionPage({
  searchParams,
}: ExtensionPageProps) {
  const resolvedSearchParams = await searchParams;
  const queryCode =
    typeof resolvedSearchParams?.code === "string"
      ? resolvedSearchParams.code
      : null;
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
        <Card className="rounded-[26px] bg-surface/60">
          <SectionHeader
            eyebrow={accountCopy.extension.status.eyebrow}
            title={accountCopy.extension.status.title}
            subtitle={accountCopy.extension.status.subtitle}
          />
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
                  caption={
                    accountCopy.extension.connected.stats.permissionsCaption
                  }
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
                // todo: make this work like this: opens the extension if it's there, and the extension prompts the user to connect to account <name>
                // if the extension is not there, we should show a button that says "install extension" and opens the extension download page
                action={
                  <Button.AsChild size="sm">
                    <a href={accountCopy.extension.empty.ctaHref}>
                      {accountCopy.extension.empty.cta}
                    </a>
                  </Button.AsChild>
                }
              />
            )}
          </div>
        </Card>

        <Card className="rounded-[26px] bg-surface/60">
          <SectionHeader
            eyebrow={accountCopy.extension.device.eyebrow}
            title={accountCopy.extension.device.title}
            subtitle={accountCopy.extension.device.subtitle}
          />
          <div className="mt-4 grid gap-3">
            <StatCard
              label={accountCopy.extension.device.primaryDevice}
              value={
                connectionReady ? accountCopy.extension.device.connected : "—"
              }
              caption={accountCopy.extension.device.primaryDeviceCaption}
              icon={<DesktopIcon className="h-4 w-4" />}
            />
            <StatCard
              label={accountCopy.extension.device.lastSeen}
              value={
                connectionReady
                  ? accountCopy.extension.device.lastSeenValue
                  : "—"
              }
              caption={accountCopy.extension.device.lastSeenCaption}
              icon={<LaptopIcon className="h-4 w-4" />}
            />
          </div>
        </Card>
      </div>

      <Card className="rounded-[26px] bg-surface/60">
        <SectionHeader
          eyebrow={accountCopy.extension.sessions.eyebrow}
          title={accountCopy.extension.sessions.title}
          subtitle={accountCopy.extension.sessions.subtitle}
          actions={
            <span className="trail-status">
              {accountCopy.extension.sessions.comingSoon}
            </span>
          }
        />
        {sessions.length ? (
          <div className="mt-4 divide-y divide-border/40">
            {sessions.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {item.device}
                  </p>
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
      </Card>
    </section>
  );
}
