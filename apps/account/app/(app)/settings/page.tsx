import { redirect } from "next/navigation";
import Image, { type ImageLoaderProps } from "next/image";
import { accountCopy } from "@trail/content";
import { Button } from "@trail/ui";
import { PageHeader } from "@/app/components/PageHeader";
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


    // todo: remove auth0
  const auth0Domain = `https://${env.AUTH0_DOMAIN}`;
  const auth0ProfileUrl = `${auth0Domain}/u/me`;
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
          <Button.AsChild
            size="sm"
            variant="outline"
            className="rounded-full border-border/60 bg-surface text-ink hover:bg-surface-high"
          >
            <a href={auth0ProfileUrl} target="_blank" rel="noreferrer">
              {settings.profile.manageCta}
            </a>
          </Button.AsChild>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div
          id="profile"
          className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6"
        >
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {settings.profile.eyebrow}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {settings.profile.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {settings.profile.subtitle}
            </p>
          </div>
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
            <Button.AsChild
              size="sm"
              variant="outline"
              className="rounded-full border-border/60 bg-surface text-ink hover:bg-surface-high"
            >
              <a href={auth0ProfileUrl} target="_blank" rel="noreferrer">
                {settings.profile.manageCta}
              </a>
            </Button.AsChild>
            <Button.AsChild
              size="sm"
              variant="outline"
              className="rounded-full border-border/60 bg-surface text-ink hover:bg-surface-high"
            >
              <a href="/auth/logout">{settings.profile.signOutCta}</a>
            </Button.AsChild>
          </div>
        </div>

        <div
          id="security"
          className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6"
        >
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {settings.security.eyebrow}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {settings.security.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {settings.security.subtitle}
            </p>
          </div>
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
            <Button.AsChild
              size="sm"
              variant="outline"
              className="rounded-full border-border/60 bg-surface text-ink hover:bg-surface-high"
            >
              <a href={auth0ProfileUrl} target="_blank" rel="noreferrer">
                {settings.security.changePasswordCta}
              </a>
            </Button.AsChild>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-border/60 bg-surface text-ink hover:bg-surface-high"
              disabled
            >
              {settings.security.signOutEverywhereCta}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div
          id="workspace"
          className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6"
        >
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {settings.workspace.eyebrow}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {settings.workspace.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {settings.workspace.subtitle}
            </p>
          </div>
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
        </div>

        <div
          id="notifications"
          className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6"
        >
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {settings.notifications.eyebrow}
            </p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {settings.notifications.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {settings.notifications.subtitle}
            </p>
          </div>
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
        </div>
      </div>

      <div
        id="data-privacy"
        className="rounded-[26px] border border-border/60 bg-surface/60 px-6 py-6"
      >
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
            {settings.data.eyebrow}
          </p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {settings.data.title}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {settings.data.subtitle}
          </p>
        </div>
        <div className="mt-5 grid gap-6 md:grid-cols-2 md:divide-x md:divide-border/40">
          <div className="space-y-3 md:pr-6">
            <p className="text-sm font-semibold text-ink">
              {settings.data.exportTitle}
            </p>
            <p className="text-xs text-ink-muted">
              {settings.data.exportDescription}
            </p>
            <Button.AsChild
              size="sm"
              className="rounded-full bg-cta text-cta-fg hover:bg-cta-hover"
            >
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
            <Button.AsChild
              size="sm"
              variant="outline"
              className="rounded-full border-border/60 bg-surface text-ink hover:bg-surface-high"
            >
              <a href={settings.data.deleteHref}>{settings.data.deleteCta}</a>
            </Button.AsChild>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border/40 pt-4 text-xs text-ink-muted">
          <span>{settings.data.supportText}</span>
          <Button.AsChild
            size="sm"
            variant="outline"
            className="rounded-full border-border/60 bg-surface text-ink hover:bg-surface-high"
          >
            <a href="mailto:support@gettrail.net">{settings.data.supportCta}</a>
          </Button.AsChild>
        </div>
      </div>
    </section>
  );
}
