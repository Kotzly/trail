import { headers } from "next/headers";
import { marketingCopy } from "@trail/content";
import { BackgroundArt, Badge, Button, Card, WaitlistDialog, cn } from "@trail/ui";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";
import { buildMetadata } from "../../lib/seo";

export const metadata = buildMetadata({
  title: "Trail Downloads — Browser installs and waitlist",
  description:
    "Join the waitlist for Chrome, Brave, Edge, and Firefox builds. We will email the right installer and help you sign in quickly.",
  path: "/downloads"
});

type BrowserTarget = "chrome" | "firefox" | "edge" | "safari" | "unknown";
type PlatformTarget = "macos" | "windows" | "linux" | "unknown";

function detectBrowser(userAgent: string): BrowserTarget {
  const ua = userAgent.toLowerCase();
  if (ua.includes("firefox")) {
    return "firefox";
  }
  if (ua.includes("edg/")) {
    return "edge";
  }
  if (ua.includes("chrome") || ua.includes("chromium")) {
    return "chrome";
  }
  if (ua.includes("safari")) {
    return "safari";
  }
  return "unknown";
}

function detectPlatform(userAgent: string): PlatformTarget {
  const ua = userAgent.toLowerCase();
  if (ua.includes("macintosh") || ua.includes("mac os x")) {
    return "macos";
  }
  if (ua.includes("windows nt")) {
    return "windows";
  }
  if (ua.includes("linux")) {
    return "linux";
  }
  return "unknown";
}

export default async function DownloadsPage() {
  const { downloads } = marketingCopy;
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") ?? "";
  const browser = detectBrowser(userAgent);
  const platform = detectPlatform(userAgent);
  const isChromium = browser === "chrome" || browser === "edge";
  const platformLabel =
    platform === "macos" ? "macOS" : platform === "windows" ? "Windows" : platform === "linux" ? "Linux" : null;
  const platformSuffix = platformLabel ? ` for ${platformLabel}` : "";
  const primaryCta =
    browser === "firefox"
      ? `join the firefox waitlist${platformSuffix}`
      : isChromium
        ? `join the chrome waitlist${platformSuffix}`
        : downloads.primaryCta;
  const browserLabel =
    browser === "firefox"
      ? "Firefox"
      : isChromium
        ? "Chrome / Chromium"
        : browser === "safari"
          ? "Safari"
          : null;
  const recommendedCard =
    browser === "firefox" ? "Firefox add-on" : isChromium ? "Chrome add-on" : null;
  const detectionNote = browserLabel && platformLabel
    ? `${browserLabel} on ${platformLabel}`
    : browserLabel ?? platformLabel;
  const supportedBrowsers = [
    { label: "Chrome / Brave", status: "waitlist", active: isChromium },
    { label: "Edge", status: "waitlist", active: browser === "edge" },
    { label: "Firefox", status: "in progress", active: browser === "firefox" },
    { label: "Safari", status: "not available yet", active: browser === "safari" }
  ];

  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="relative overflow-hidden">
        <BackgroundArt variant="graph" />
        <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-16">
          <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-8">
              <Badge className="trail-eyebrow border border-stroke/40 bg-surface/70">
                {downloads.eyebrow}
              </Badge>
              <div className="space-y-4">
                <h1 className="font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
                  {downloads.title}
                </h1>
                <p className="max-w-2xl text-[1rem] text-ink-muted">{downloads.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <WaitlistDialog
                  triggerLabel={primaryCta}
                  title="Get the download link"
                  description="Share an email and we will send the install link as soon as the build is ready."
                  successTitle="You are on the list"
                  successDescription="We will email you the moment downloads open for the platform."
                  successCtaLabel="Back to downloads"
                  source={`downloads-${browser}-${platform}`}
                  buttonSize="lg"
                />
                <Button.AsChild variant="outline" size="lg">
                  <a href="https://app.gettrail.net">{downloads.secondaryCta}</a>
                </Button.AsChild>
              </div>
              {detectionNote ? (
                <p className="text-xs text-ink-subtle">
                  Detected: {detectionNote}. We will email the right build when it is ready.
                </p>
              ) : null}
              <div>
                <p className="trail-eyebrow">Supported platforms</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {supportedBrowsers.map((item) => (
                    <span
                      key={item.label}
                      className={cn(
                        "rounded-full border border-stroke/50 bg-surface/70 px-3 py-1 text-[11px] font-semibold text-ink-subtle",
                        item.active ? "border-accent/40 text-ink shadow-elev-1" : null
                      )}
                    >
                      {item.label} · {item.status}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-stroke/40 bg-surface/70 p-4 text-sm text-ink-muted">
                <p>
                  Builds roll out in waves so we can keep performance stable and respond
                  quickly to platform updates. Joining the list makes sure you receive the
                  right installer the moment the build is ready.
                </p>
                <p className="mt-3">
                  You will get a single email with the install link and a quick checklist
                  to verify permissions. If a team needs a guided rollout, let us know
                  and we can share onboarding steps.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {downloads.cards.map((card) => (
                  <Card
                    key={card.title}
                    className={cn(
                      "trail-card p-5",
                      recommendedCard === card.title ? "border-accent/40 shadow-elev-1" : null
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="trail-eyebrow">{card.title}</p>
                      <span className="trail-status">
                        {card.status}
                      </span>
                    </div>
                    <p className="trail-copy mt-3">{card.copy}</p>
                  </Card>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <Card className="trail-panel p-7">
                <p className="trail-eyebrow">{downloads.stepsTitle}</p>
                <div className="mt-5 space-y-4">
                  {downloads.steps.map((step, index) => (
                    <div
                      key={step.title}
                      className="trail-step flex items-start gap-4"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-cta-fg">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">{step.title}</p>
                        <p className="trail-copy mt-1 text-xs">{step.copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="trail-card-neutral p-6">
                <p className="trail-eyebrow">{downloads.noteTitle}</p>
                <p className="trail-copy mt-2">{downloads.noteCopy}</p>
                {downloads.noteCta && downloads.noteCtaHref ? (
                  <Button.AsChild variant="outline" size="sm" className="mt-4">
                    <a href={downloads.noteCtaHref}>{downloads.noteCta}</a>
                  </Button.AsChild>
                ) : null}
              </Card>
              <Card className="trail-card-neutral p-6">
                <p className="trail-eyebrow">installation checklist</p>
                <div className="mt-3 space-y-3 text-sm text-ink-muted">
                  <p>
                    The app installs like any standard add-on. Once it is
                    pinned, you can start a research path from any tab and add notes as you go.
                  </p>
                  <p>
                    After installation, sign in to enable syncing across devices and
                    to share paths with teammates. If you prefer to keep work local,
                    you can skip syncing and still export whenever you need to.
                  </p>
                  <p>
                    We recommend starting a dedicated path for each project or client
                    so that timelines stay clean and decisions stay easy to trace. You
                    can rename, archive, or export any path later without losing the
                    underlying sources.
                  </p>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-ink">
                  <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-2">
                    Pin the app so it is always visible in the toolbar.
                  </li>
                  <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-2">
                    Start a path before deep research sessions to keep context.
                  </li>
                  <li className="rounded-2xl border border-stroke/40 bg-base/70 px-4 py-2">
                    Use exports to share paths with stakeholders or clients.
                  </li>
                </ul>
                <p className="mt-4 text-sm text-ink-muted">
                  Need help installing? Visit Support and we can walk you through
                  permissions, syncing, or sign-in steps for the platform.
                </p>
              </Card>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
