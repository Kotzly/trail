import Link from "next/link";
import { ArrowRightIcon } from "@trail/ui/icons";
import { Button, Card, EmptyState, SectionHeader } from "@trail/ui";
import { accountCopy } from "@trail/content";
import { PageHeader } from "@trail/ui";
import { getAccountUsageSnapshot } from "@/src/server/account-usage";
import {
  formatDeviceLastSeen,
  formatDeviceLocation,
  formatDeviceName,
} from "@/src/server/device-presentation";

export default async function SessionsPage() {
  const { sessions } = accountCopy;
  const usage = await getAccountUsageSnapshot();
  const connectedDevices = usage.devices;
  const hasSessions = connectedDevices.length > 0;

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow={accountCopy.nav.sessions}
        title={sessions.title}
        subtitle={sessions.subtitle}
        actions={
          <Button.AsChild size="sm">
            <Link href="/extension" className="inline-flex items-center gap-2">
              {sessions.guidance.cta}
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </Button.AsChild>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="rounded-[26px] bg-surface/60">
          <SectionHeader
            eyebrow={sessions.list.eyebrow}
            title={sessions.list.title}
            subtitle={sessions.list.subtitle}
          />

          {hasSessions ? (
            <div className="mt-4 divide-y divide-border/40">
              {connectedDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {formatDeviceName(device)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatDeviceLocation(device)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="trail-status">{device.status.toLowerCase()}</span>
                    <span className="text-xs text-ink-muted">
                      {formatDeviceLastSeen(device)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5">
              <EmptyState
                title={sessions.list.emptyTitle}
                description={sessions.list.emptyDescription}
                icon={
                  <span className="h-5 w-5 rounded-full border border-border/60" />
                }
                items={sessions.list.emptyItems}
                action={
                  <Button.AsChild size="sm">
                    <Link href="/extension">{sessions.guidance.cta}</Link>
                  </Button.AsChild>
                }
              />
            </div>
          )}
        </Card>

        <Card className="rounded-[26px] bg-surface/60">
          <SectionHeader
            eyebrow={sessions.posture.eyebrow}
            title={sessions.posture.title}
            subtitle={sessions.posture.subtitle}
          />
          <div className="mt-4 grid gap-3">
            {sessions.posture.items.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-ink-muted">{item.label}</span>
                <span className="trail-status">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="rounded-[26px] bg-surface/60 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">
              {sessions.guidance.title}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {sessions.guidance.description}
            </p>
          </div>
          <Button.AsChild size="sm" variant="outline">
            <Link href="/extension">{sessions.guidance.cta}</Link>
          </Button.AsChild>
        </div>
      </Card>
    </section>
  );
}
