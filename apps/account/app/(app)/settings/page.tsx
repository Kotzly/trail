import { accountCopy } from "@trail/content";

export default function SettingsPage() {
  const { settings } = accountCopy;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{settings.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{settings.subtitle}</p>
      </div>
      <div className="grid gap-4">
        <div className="rounded-2xl border border-border/50 bg-surface/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Profile</p>
          <p className="mt-3 text-sm text-ink-muted">Sync profile settings from Auth0.</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-surface/80 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-muted">Security</p>
          <p className="mt-3 text-sm text-ink-muted">Control sessions, devices, and access tokens.</p>
        </div>
      </div>
    </section>
  );
}
