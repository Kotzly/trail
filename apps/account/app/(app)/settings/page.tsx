import { redirect } from "next/navigation";
import Image, { type ImageLoaderProps } from "next/image";
import { accountCopy } from "@trail/content";
import { Button } from "@trail/ui";
import {
  getAuthTokenFromCookies,
  getAuthUserFromToken,
  getDevUser,
  isAuthBypassed
} from "@/src/lib/auth";

const avatarLoader = ({ src }: ImageLoaderProps) => src;

async function getAccountUser() {
  if (isAuthBypassed()) {
    return getDevUser();
  }

  const token = await getAuthTokenFromCookies();
  if (!token) {
    return null;
  }

  return getAuthUserFromToken(token);
}

export default async function SettingsPage() {
  const { settings } = accountCopy;
  const user = await getAccountUser();

  if (!user) {
    redirect("/auth/login");
  }

  const initialsSource = user.name || user.email || settings.profile.fallbackName;
  const initials = initialsSource
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toLowerCase())
    .join("");

  const authPortalUrl = "https://auth.gettrail.net";

  const sessions = [
    {
      id: "current",
      device: settings.security.currentSession,
      location: settings.security.currentLocation,
      lastSeen: settings.security.currentActivity
    }
  ];

  return (
    <section className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div id="profile" className="rounded-2xl border border-border/60 bg-surface/70 p-4">
          <div>
            <p className="text-xs text-ink-muted">{settings.profile.eyebrow}</p>
            <p className="text-sm font-semibold text-ink">{settings.profile.title}</p>
            <p className="text-xs text-ink-muted">{settings.profile.subtitle}</p>
          </div>
          <div className="mt-4 flex items-center gap-4">
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
              <a href={authPortalUrl} target="_blank" rel="noreferrer">
                {settings.profile.manageCta}
              </a>
            </Button.AsChild>
            <Button.AsChild size="sm" variant="ghost">
              <a href="/auth/logout">{settings.profile.signOutCta}</a>
            </Button.AsChild>
          </div>
        </div>

        <div id="security" className="rounded-2xl border border-border/60 bg-surface/70 p-4">
          <div>
            <p className="text-xs text-ink-muted">{settings.security.eyebrow}</p>
            <p className="text-sm font-semibold text-ink">{settings.security.title}</p>
            <p className="text-xs text-ink-muted">{settings.security.subtitle}</p>
          </div>
          <div className="mt-4 divide-y divide-border/40">
            {sessions.map((sessionItem) => (
              <div
                key={sessionItem.id}
                className="flex flex-wrap items-center justify-between gap-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{sessionItem.device}</p>
                  <p className="text-xs text-ink-muted">{sessionItem.location}</p>
                </div>
                <span className="trail-status">{sessionItem.lastSeen}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
            <a href={authPortalUrl} target="_blank" rel="noreferrer" className="text-ink">
              {settings.security.changePasswordCta}
            </a>
            <span>•</span>
            <span>{settings.security.signOutEverywhereCta}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div id="workspace" className="rounded-2xl border border-border/60 bg-surface/70 p-4">
          <div>
            <p className="text-xs text-ink-muted">{settings.workspace.eyebrow}</p>
            <p className="text-sm font-semibold text-ink">{settings.workspace.title}</p>
            <p className="text-xs text-ink-muted">{settings.workspace.subtitle}</p>
          </div>
          <div className="mt-4 divide-y divide-border/40">
            <div className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">{settings.workspace.soloTitle}</p>
                <p className="text-xs text-ink-muted">{settings.workspace.soloDescription}</p>
              </div>
              <span className="trail-status">{settings.workspace.soloBadge}</span>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 text-ink-muted">
              <div>
                <p className="text-sm font-semibold text-ink">{settings.workspace.teamTitle}</p>
                <p className="text-xs text-ink-muted">{settings.workspace.teamDescription}</p>
              </div>
              <span className="text-[0.7rem] font-semibold lowercase text-ink-muted">
                {settings.workspace.comingSoon}
              </span>
            </div>
          </div>
        </div>

        <div id="notifications" className="rounded-2xl border border-border/60 bg-surface/70 p-4">
          <div>
            <p className="text-xs text-ink-muted">{settings.notifications.eyebrow}</p>
            <p className="text-sm font-semibold text-ink">{settings.notifications.title}</p>
            <p className="text-xs text-ink-muted">{settings.notifications.subtitle}</p>
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

      <div id="data-privacy" className="rounded-2xl border border-border/60 bg-surface/70 p-4">
        <div>
          <p className="text-xs text-ink-muted">{settings.data.eyebrow}</p>
          <p className="text-sm font-semibold text-ink">{settings.data.title}</p>
          <p className="text-xs text-ink-muted">{settings.data.subtitle}</p>
        </div>
        <div className="mt-4 grid gap-6 md:grid-cols-2 md:divide-x md:divide-border/40">
          <div className="space-y-2 md:pr-6">
            <p className="text-sm font-semibold text-ink">{settings.data.exportTitle}</p>
            <p className="text-xs text-ink-muted">{settings.data.exportDescription}</p>
            <a
              href={settings.data.exportHref}
              className="mt-3 inline-flex text-xs font-semibold text-ink"
            >
              {settings.data.exportCta}
            </a>
          </div>
          <div className="space-y-2 md:pl-6">
            <p className="text-sm font-semibold text-ink">{settings.data.deleteTitle}</p>
            <p className="text-xs text-ink-muted">{settings.data.deleteDescription}</p>
            <a
              href={settings.data.deleteHref}
              className="mt-3 inline-flex text-xs font-semibold text-ink"
            >
              {settings.data.deleteCta}
            </a>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <span>{settings.data.supportText}</span>
          <a href="mailto:support@gettrail.net" className="text-ink">
            {settings.data.supportCta}
          </a>
        </div>
      </div>
    </section>
  );
}
