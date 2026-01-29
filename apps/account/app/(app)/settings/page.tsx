import { redirect } from "next/navigation";
import { Button, SectionHeader } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { auth0 } from "@/src/lib/auth0";

export default async function SettingsPage() {
  const { settings } = accountCopy;
  const session = await auth0.getSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const user = session.user;
  const initialsSource = user.name || user.email || "Trail";
  const initials = initialsSource
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase())
    .join("");

  const auth0Domain = process.env.AUTH0_DOMAIN
    ? `https://${process.env.AUTH0_DOMAIN}`
    : null;
  const auth0ProfileUrl = auth0Domain ? `${auth0Domain}/u/me` : "https://auth0.com/";

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
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div id="profile" className="trail-card p-6">
          <SectionHeader title={settings.profile.title} subtitle={settings.profile.subtitle} />
          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-surface text-sm font-semibold text-ink">
              {user.picture ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.picture}
                  alt={user.name ?? "User avatar"}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{user.name ?? settings.profile.fallbackName}</p>
              <p className="text-xs text-ink-muted">{user.email ?? settings.profile.fallbackEmail}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="sm">
              <a href={auth0ProfileUrl} target="_blank" rel="noreferrer">
                {settings.profile.manageCta}
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/auth/logout">{settings.profile.signOutCta}</a>
            </Button>
          </div>
        </div>

        <div id="security" className="trail-card p-6">
          <SectionHeader title={settings.security.title} subtitle={settings.security.subtitle} />
          <div className="mt-5 space-y-3">
            {sessions.map((sessionItem) => (
              <div
                key={sessionItem.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-surface/80 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{sessionItem.device}</p>
                  <p className="text-xs text-ink-muted">{sessionItem.location}</p>
                </div>
                <span className="trail-status">{sessionItem.lastSeen}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="outline" size="sm">
              <a href={auth0ProfileUrl} target="_blank" rel="noreferrer">
                {settings.security.changePasswordCta}
              </a>
            </Button>
            <Button variant="ghost" size="sm" disabled>
              {settings.security.signOutEverywhereCta}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div id="workspace" className="trail-card p-6">
          <SectionHeader title={settings.workspace.title} subtitle={settings.workspace.subtitle} />
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface/80 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">{settings.workspace.soloTitle}</p>
                <p className="text-xs text-ink-muted">{settings.workspace.soloDescription}</p>
              </div>
              <span className="trail-pill">{settings.workspace.soloBadge}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface/60 px-4 py-3 opacity-70">
              <div>
                <p className="text-sm font-semibold text-ink">{settings.workspace.teamTitle}</p>
                <p className="text-xs text-ink-muted">{settings.workspace.teamDescription}</p>
              </div>
              <span className="trail-pill">{settings.workspace.comingSoon}</span>
            </div>
          </div>
        </div>

        <div id="notifications" className="trail-card p-6">
          <SectionHeader
            title={settings.notifications.title}
            subtitle={settings.notifications.subtitle}
          />
          <div className="mt-5 space-y-3 text-sm text-ink-muted">
            {settings.notifications.items.map((item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface/80 px-4 py-3"
              >
                <span>{item}</span>
                <span className="text-xs text-ink-subtle">{settings.notifications.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="data-privacy" className="trail-card p-6">
        <SectionHeader title={settings.data.title} subtitle={settings.data.subtitle} />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-surface/80 p-4">
            <p className="text-sm font-semibold text-ink">{settings.data.exportTitle}</p>
            <p className="mt-2 text-xs text-ink-muted">{settings.data.exportDescription}</p>
            <Button variant="outline" size="sm" className="mt-4" disabled>
              {settings.data.exportCta}
            </Button>
          </div>
          <div className="rounded-2xl border border-border/60 bg-surface/80 p-4">
            <p className="text-sm font-semibold text-ink">{settings.data.deleteTitle}</p>
            <p className="mt-2 text-xs text-ink-muted">{settings.data.deleteDescription}</p>
            <Button variant="outline" size="sm" className="mt-4" disabled>
              {settings.data.deleteCta}
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          <span>{settings.data.supportText}</span>
          <a href="mailto:support@gettrail.net" className="text-ink transition hover:text-ink">
            {settings.data.supportCta}
          </a>
        </div>
      </div>
    </section>
  );
}
