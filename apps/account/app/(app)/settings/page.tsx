import { redirect } from "next/navigation";
import Image, { type ImageLoaderProps } from "next/image";
import { accountCopy } from "@trail/content";
import { Button, Card, PageHeader, SectionHeader } from "@trail/ui";
import { getAuthSession } from "@/src/lib/auth";
import { env } from "@/src/env";

const avatarLoader = ({ src }: ImageLoaderProps) => src;

export default async function SettingsPage() {
  const { settings } = accountCopy;
  const session = await getAuthSession();
  const user = session?.user;

  if (!user) {
    redirect("/auth/login");
  }

  const initialsSource =
    user.name || user.email || settings.profile.fallbackName;
  const initials = initialsSource
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toLowerCase())
    .join("");

  const betterAuthAccountUrl = new URL(
    "/account",
    env.TRAIL_AUTH_BASE_URL,
  ).toString();
  const sessions = [
    {
      id: "current",
      device: settings.security.currentSession,
      location: settings.security.currentLocation,
      lastSeen: settings.security.currentActivity,
    },
  ];

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow={accountCopy.nav.settings}
        title={settings.title}
        subtitle={settings.subtitle}
        actions={
          <Button.AsChild size="sm" variant="outline">
            <a href={betterAuthAccountUrl} target="_blank" rel="noreferrer">
              {settings.profile.manageCta}
            </a>
          </Button.AsChild>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card id="profile" className="rounded-[26px] bg-surface/60">
          <SectionHeader
            eyebrow={settings.profile.eyebrow}
            title={settings.profile.title}
            subtitle={settings.profile.subtitle}
          />
          <div className="mt-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-surface text-sm font-semibold text-ink">
              {user.imageUrl ? (
                <Image
                  loader={avatarLoader}
                  unoptimized
                  src={user.imageUrl}
                  alt={user.name ?? settings.profile.avatarAlt}
                  width={48}
                  height={48}
                  sizes="48px"
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div>
              <p className="text-sm font-semibold lowercase text-ink">
                {user.name ?? settings.profile.fallbackName}
              </p>
              <p className="text-xs lowercase text-ink-muted">
                {user.email ?? settings.profile.fallbackEmail}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button.AsChild size="sm" variant="outline">
              <a href={betterAuthAccountUrl} target="_blank" rel="noreferrer">
                {settings.profile.manageCta}
              </a>
            </Button.AsChild>
            <Button.AsChild size="sm" variant="outline">
              <a href="/auth/logout">{settings.profile.signOutCta}</a>
            </Button.AsChild>
          </div>
        </Card>

        <Card id="security" className="rounded-[26px] bg-surface/60">
          <SectionHeader
            eyebrow={settings.security.eyebrow}
            title={settings.security.title}
            subtitle={settings.security.subtitle}
          />
          <div className="mt-4 divide-y divide-border/40">
            {sessions.map((sessionItem) => (
              <div
                key={sessionItem.id}
                className="flex flex-wrap items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {sessionItem.device}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {sessionItem.location}
                  </p>
                </div>
                <span className="trail-status">{sessionItem.lastSeen}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button.AsChild size="sm" variant="outline">
              <a href={betterAuthAccountUrl} target="_blank" rel="noreferrer">
                {settings.security.changePasswordCta}
              </a>
            </Button.AsChild>
            <Button
              size="sm"
              variant="outline"
              disabled
            >
              {settings.security.signOutEverywhereCta}
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="workspace" className="rounded-[26px] bg-surface/60">
          <SectionHeader
            eyebrow={settings.workspace.eyebrow}
            title={settings.workspace.title}
            subtitle={settings.workspace.subtitle}
          />
          <div className="mt-4 divide-y divide-border/40">
            <div className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {settings.workspace.soloTitle}
                </p>
                <p className="text-xs text-ink-muted">
                  {settings.workspace.soloDescription}
                </p>
              </div>
              <span className="trail-status">
                {settings.workspace.soloBadge}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 text-ink-muted">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {settings.workspace.teamTitle}
                </p>
                <p className="text-xs text-ink-muted">
                  {settings.workspace.teamDescription}
                </p>
              </div>
              <span className="text-[0.7rem] font-semibold lowercase text-ink-muted">
                {settings.workspace.comingSoon}
              </span>
            </div>
          </div>
        </Card>

        <Card id="notifications" className="rounded-[26px] bg-surface/60">
          <SectionHeader
            eyebrow={settings.notifications.eyebrow}
            title={settings.notifications.title}
            subtitle={settings.notifications.subtitle}
          />
          <div className="mt-4 divide-y divide-border/40 text-xs text-ink-muted">
            {settings.notifications.items.map((item) => (
              <div
                key={item}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span>{item}</span>
                <span className="text-[0.7rem] font-semibold lowercase text-ink-muted">
                  {settings.notifications.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card id="data-privacy" className="rounded-[26px] bg-surface/60">
        <SectionHeader
          eyebrow={settings.data.eyebrow}
          title={settings.data.title}
          subtitle={settings.data.subtitle}
        />
        <div className="mt-5 grid gap-6 md:grid-cols-2 md:divide-x md:divide-border/40">
          <div className="space-y-3 md:pr-6">
            <p className="text-sm font-semibold text-ink">
              {settings.data.exportTitle}
            </p>
            <p className="text-xs text-ink-muted">
              {settings.data.exportDescription}
            </p>
            <Button.AsChild size="sm">
              <a href={settings.data.exportHref}>{settings.data.exportCta}</a>
            </Button.AsChild>
          </div>
          <div className="space-y-3 md:pl-6">
            <p className="text-sm font-semibold text-ink">
              {settings.data.deleteTitle}
            </p>
            <p className="text-xs text-ink-muted">
              {settings.data.deleteDescription}
            </p>
            <Button.AsChild size="sm" variant="outline">
              <a href={settings.data.deleteHref}>{settings.data.deleteCta}</a>
            </Button.AsChild>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border/40 pt-4 text-xs text-ink-muted">
          <span>{settings.data.supportText}</span>
          <Button.AsChild size="sm" variant="outline">
            <a href="mailto:support@gettrail.net">{settings.data.supportCta}</a>
          </Button.AsChild>
        </div>
      </Card>
    </section>
  );
}
