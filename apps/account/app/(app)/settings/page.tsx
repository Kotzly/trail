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
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border border-border/50 bg-surface/80 p-6">
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
          <p className="mt-4 text-xs text-ink-subtle">
            Auth provider: {user.sub?.split("|")[0] ?? "auth0"}
          </p>
        </Card>
        <Card className="border border-border/50 bg-surface/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Preferences</p>
          <p className="mt-3 text-sm text-ink-muted">
            Use the theme toggle in the sidebar to switch light, dark, or system mode.
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            Extension sync happens automatically once you approve the connection.
          </p>
        </Card>
        <Card className="border border-border/50 bg-surface/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Security</p>
          <p className="mt-3 text-sm text-ink-muted">
            Sign out to end your session across Trail apps.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <a href="/auth/logout">Sign out</a>
          </Button>
        </Card>
      </div>
    </section>
  );
}
