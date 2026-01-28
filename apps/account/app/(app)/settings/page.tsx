import { redirect } from "next/navigation";
import { accountCopy } from "@trail/content";
import { Button, Card } from "@trail/ui";
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

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{settings.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{settings.subtitle}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="trail-card-soft p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Profile</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-sm font-semibold text-surface">
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{user.name ?? "Trail member"}</p>
              <p className="text-xs text-ink-subtle">{user.email ?? "Signed in"}</p>
            </div>
          </div>
        </Card>
        <Card className="trail-card-soft p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Preferences</p>
          <p className="mt-3 text-sm text-ink-muted">
            Use the theme toggle in the sidebar to switch light, dark, or system mode.
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            Extension sync happens automatically once you approve the connection.
          </p>
        </Card>
        <Card className="trail-card-soft p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Connected extension</p>
          <p className="mt-3 text-sm text-ink-muted">
            Connect your browser extension to sync trails and unlock sharing.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <a href="/extension">Open extension</a>
          </Button>
        </Card>
        <Card className="trail-card-soft p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Security</p>
          <p className="mt-3 text-sm text-ink-muted">
            Sign out to end your session across Trail apps.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <a href="/auth/logout">Sign out</a>
          </Button>
        </Card>
        <Card className="trail-card-soft p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Data & privacy</p>
          <p className="mt-3 text-sm text-ink-muted">
            Trail stores metadata only. You stay in control of what gets synced and shared.
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            Need an export or deletion request? Reach out to support.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <a href="mailto:support@gettrail.net">Contact support</a>
          </Button>
        </Card>
      </div>
    </section>
  );
}
