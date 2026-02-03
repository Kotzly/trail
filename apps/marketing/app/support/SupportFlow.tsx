"use client";

import * as React from "react";

import { marketingCopy } from "@trail/content";
import { Button, Card, cn } from "@trail/ui";

type SupportPath = "bug" | "account" | "feature" | "faq";

type CopyStatus = "idle" | "copied" | "error";

const QUICK_CHECKS_BUG = [
  {
    id: "refresh",
    label: "Refresh and try again",
    hint: "Hard refresh helps when sign-in looks stuck.",
  },
  {
    id: "enabled",
    label: "Make sure the add-on is enabled",
    hint: "Open chrome://extensions and toggle the add-on on.",
  },
  {
    id: "incognito",
    label: "Try an incognito window",
    hint: "Rules out cookie / add-on conflicts.",
  },
] as const;

const QUICK_CHECKS_ACCOUNT = [
  {
    id: "email",
    label: "Double-check the email address",
    hint: "Try the email you used to sign up (work vs personal).",
  },
  {
    id: "cookies",
    label: "Allow cookies for gettrail.net and auth.gettrail.net",
    hint: "Strict blockers can break sign-in redirects.",
  },
  {
    id: "retry",
    label: "Log out and sign in again",
    hint: "If it loops, hard refresh first.",
  },
] as const;

function encodeMailto(email: string, subject: string, body: string) {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${email}?${params.toString()}`;
}

function safeWriteClipboard(text: string): Promise<void> {
  if (typeof navigator === "undefined") {
    return Promise.reject(new Error("clipboard_unavailable"));
  }

  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (!ok) {
        reject(new Error("copy_failed"));
        return;
      }
      resolve();
    } catch (error) {
      reject(error instanceof Error ? error : new Error("copy_failed"));
    }
  });
}

function detectPlatform(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("macintosh") || ua.includes("mac os x")) return "macOS";
  if (ua.includes("windows nt")) return "Windows";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";
  if (ua.includes("linux")) return "Linux";
  return "Unknown";
}

function detectBrowser(userAgent: string): { name: string; version: string | null } {
  const ua = userAgent;
  const lower = ua.toLowerCase();

  const matchVersion = (pattern: RegExp) => {
    const match = ua.match(pattern);
    return match?.[1] ?? null;
  };

  if (lower.includes("firefox/")) {
    return { name: "Firefox", version: matchVersion(/Firefox\/([0-9.]+)/) };
  }

  if (lower.includes("edg/")) {
    return { name: "Edge", version: matchVersion(/Edg\/([0-9.]+)/) };
  }

  if (lower.includes("chrome/") || lower.includes("chromium/")) {
    return { name: "Chrome", version: matchVersion(/Chrom(?:e|ium)\/([0-9.]+)/) };
  }

  if (lower.includes("safari") && lower.includes("version/") && !lower.includes("chrome")) {
    return { name: "Safari", version: matchVersion(/Version\/([0-9.]+)/) };
  }

  return { name: "Unknown", version: null };
}

function formatDiagnostics(input: {
  accountEmail?: string;
  extensionVersion?: string;
  browser?: string;
  os?: string;
}): string {
  return [
    "Trail diagnostics",
    `Account email: ${input.accountEmail?.trim() || "(not provided)"}`,
    `Client: ${input.browser || "(unknown)"}`,
    `OS: ${input.os || "(unknown)"}`,
    `Add-on version: ${input.extensionVersion?.trim() || "(not provided)"}`,
  ].join("\n");
}

function StepBadge({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-cta-fg">
        {step}
      </span>
      <p className="font-display text-base font-semibold text-ink">{label}</p>
    </div>
  );
}

function TriageCard({
  title,
  description,
  selected,
  onClick,
  tone = "default",
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  tone?: "default" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full rounded-3xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        tone === "default" ? "bg-surface/70" : "bg-surface/50",
        selected
          ? "border-accent/40 shadow-elev-1"
          : "border-stroke/40 hover:border-accent/30 hover:bg-surface/70"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold tracking-tight text-ink">
            {title}
          </p>
          <p className="mt-2 text-sm text-ink-subtle">
            {description}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full border border-stroke/60 bg-surface/70 text-ink/70 transition",
            selected ? "border-ink/25 text-ink" : "group-hover:border-ink/25 group-hover:text-ink"
          )}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </button>
  );
}

function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <details className="group rounded-2xl border border-stroke/50 bg-surface/70 px-5 py-4 transition hover:border-ink/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span className="font-display text-sm font-semibold text-ink">{question}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-stroke/60 bg-surface/70 text-ink/70 transition group-hover:border-ink/25 group-hover:text-ink group-open:rotate-180">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <p className="mt-3 text-sm text-ink-subtle">{answer}</p>
    </details>
  );
}

export function SupportFlow() {
  const { support, faq } = marketingCopy;
  const [path, setPath] = React.useState<SupportPath | null>(null);
  const detailsRef = React.useRef<HTMLDivElement | null>(null);
  const stepThreeRef = React.useRef<HTMLDivElement | null>(null);

  const [accountEmail, setAccountEmail] = React.useState("");
  const [extensionVersion, setExtensionVersion] = React.useState("");
  const [whatHappened, setWhatHappened] = React.useState("");
  const [stepsToReproduce, setStepsToReproduce] = React.useState("");
  const [expected, setExpected] = React.useState("");

  const [featureGoal, setFeatureGoal] = React.useState("");
  const [featureBlocker, setFeatureBlocker] = React.useState("");
  const [featureFrequency, setFeatureFrequency] = React.useState("sometimes");
  const [featureMore, setFeatureMore] = React.useState("");

  const [faqQuery, setFaqQuery] = React.useState("");
  const [copyDiagStatus, setCopyDiagStatus] = React.useState<CopyStatus>("idle");
  const [copyFeatureStatus, setCopyFeatureStatus] = React.useState<CopyStatus>("idle");

  const [ua, setUa] = React.useState("");
  React.useEffect(() => {
    setUa(typeof navigator === "undefined" ? "" : navigator.userAgent);
  }, []);

  const browser = React.useMemo(() => detectBrowser(ua), [ua]);
  const os = React.useMemo(() => detectPlatform(ua), [ua]);
  const browserLabel = React.useMemo(() => {
    return browser.version ? `${browser.name} ${browser.version}` : browser.name;
  }, [browser]);

  const activeChecks = path === "account" ? QUICK_CHECKS_ACCOUNT : QUICK_CHECKS_BUG;
  const [checks, setChecks] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (path !== "bug" && path !== "account") {
      return;
    }

    const defaults =
      path === "account"
        ? Object.fromEntries(QUICK_CHECKS_ACCOUNT.map((item) => [item.id, false]))
        : Object.fromEntries(QUICK_CHECKS_BUG.map((item) => [item.id, false]));

    setChecks(defaults);
    setCopyDiagStatus("idle");
  }, [path]);

  React.useEffect(() => {
    if (!path) {
      return;
    }
    window.requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [path]);

  const checksDoneCount = React.useMemo(() => {
    return Object.values(checks).filter(Boolean).length;
  }, [checks]);

  const checksTotal = activeChecks.length;
  const checksComplete = checksTotal > 0 && checksDoneCount === checksTotal;
  const canContactSupport = (path === "bug" || path === "account") ? checksComplete : false;

  React.useEffect(() => {
    if (!checksComplete || (path !== "bug" && path !== "account")) {
      return;
    }
    window.requestAnimationFrame(() => {
      stepThreeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [checksComplete, path]);

  const diagnostics = React.useMemo(() => {
    return formatDiagnostics({
      accountEmail,
      extensionVersion,
      browser: browserLabel,
      os,
    });
  }, [accountEmail, extensionVersion, browserLabel, os]);

  const supportEmailBody = React.useMemo(() => {
    return [
      diagnostics,
      "",
      "What happened:",
      whatHappened.trim() || "(describe the issue)",
      "",
      "What you expected:",
      expected.trim() || "(what you expected to happen)",
      "",
      "Steps to reproduce:",
      stepsToReproduce.trim() || "(steps)",
      "",
      "Optional: screenshot / short recording / trail link",
    ].join("\n");
  }, [diagnostics, whatHappened, expected, stepsToReproduce]);

  const featureEmailBody = React.useMemo(() => {
    return [
      "Trail feature request",
      "",
      `How often: ${featureFrequency}`,
      "",
      "What are you trying to do?",
      featureGoal.trim() || "(describe the goal)",
      "",
      "What blocks you?",
      featureBlocker.trim() || "(describe the blocker)",
      "",
      "More context (optional):",
      featureMore.trim() || "(optional)",
    ].join("\n");
  }, [featureFrequency, featureGoal, featureBlocker, featureMore]);

  const onCopyDiagnostics = async () => {
    try {
      await safeWriteClipboard(diagnostics);
      setCopyDiagStatus("copied");
      window.setTimeout(() => setCopyDiagStatus("idle"), 1400);
    } catch {
      setCopyDiagStatus("error");
      window.setTimeout(() => setCopyDiagStatus("idle"), 2000);
    }
  };

  const onCopyFeature = async () => {
    try {
      await safeWriteClipboard(featureEmailBody);
      setCopyFeatureStatus("copied");
      window.setTimeout(() => setCopyFeatureStatus("idle"), 1400);
    } catch {
      setCopyFeatureStatus("error");
      window.setTimeout(() => setCopyFeatureStatus("idle"), 2000);
    }
  };

  const onContactSupport = () => {
    if (!canContactSupport) {
      return;
    }
    window.location.href = encodeMailto(support.email, "Trail support", supportEmailBody);
  };

  const onSendFeatureRequest = () => {
    if (!featureGoal.trim() || !featureBlocker.trim()) {
      return;
    }
    window.location.href = encodeMailto(support.email, "Trail feature request", featureEmailBody);
  };

  const filteredFaq = React.useMemo(() => {
    const query = faqQuery.trim().toLowerCase();
    if (!query) {
      return faq.items;
    }
    return faq.items.filter((item) => {
      return (
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query)
      );
    });
  }, [faq.items, faqQuery]);

  return (
    <section className="relative mx-auto max-w-6xl px-6 pb-14 pt-10">
      <div className="mx-auto max-w-3xl text-center">
        <p className="trail-eyebrow text-ink-subtle">{support.eyebrow}</p>
        <h2 className="mt-5 font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
          {support.title}
        </h2>
        <p className="mt-4 text-[1rem] text-ink-muted">
          {support.subtitle}
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-5xl space-y-6">
        <Card className="trail-panel p-6 reveal">
          <StepBadge step={1} label="Choose a topic" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <TriageCard
              title="Something's broken"
              description="Add-on issues, capture problems, sharing bugs."
              selected={path === "bug"}
              tone="default"
              onClick={() => setPath("bug")}
            />
            <TriageCard
              title="Sign-in / account"
              description="Login loops, account access, billing questions."
              selected={path === "account"}
              tone="default"
              onClick={() => setPath("account")}
            />
            <TriageCard
              title="Request a feature"
              description="Tell us what you want Trail to do next."
              selected={path === "feature"}
              tone="muted"
              onClick={() => setPath("feature")}
            />
            <TriageCard
              title="FAQ / privacy / platforms"
              description="Quick answers and common fixes."
              selected={path === "faq"}
              tone="muted"
              onClick={() => setPath("faq")}
            />
          </div>
        </Card>

        {path ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-subtle">
            <span>
              Need human help? Email{" "}
              <a className="font-semibold text-ink underline underline-offset-4" href={`mailto:${support.email}`}>
                {support.email}
              </a>
              .
            </span>
            <button
              type="button"
              onClick={() => setPath(null)}
              className="rounded-full border border-stroke/60 bg-surface/60 px-4 py-2 text-xs font-semibold text-ink-subtle transition hover:border-ink/20 hover:text-ink"
            >
              back
            </button>
          </div>
        ) : null}
      </div>

      <div ref={detailsRef} className="mx-auto mt-10 max-w-5xl space-y-6">
        {path === "bug" || path === "account" ? (
          <>
            <Card className="trail-panel p-6 reveal">
              <StepBadge
                step={2}
                label={path === "account" ? "Quick checks for account issues" : "Quick checks for bugs"}
              />
              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-subtle">
                <span>
                  {checksDoneCount}/{checksTotal} done
                </span>
                <span>takes ~30s</span>
              </div>

              <div className="mt-5 space-y-3">
                {activeChecks.map((item) => {
                  const checked = Boolean(checks[item.id]);
                  return (
                    <label
                      key={item.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-2xl border border-stroke/50 bg-surface/70 px-4 py-3 transition hover:border-ink/20",
                        checked ? "border-ink/20" : null
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setChecks((prev) => ({ ...prev, [item.id]: event.target.checked }));
                        }}
                        className="mt-1 h-4 w-4"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">
                          {item.label}
                        </span>
                        <span className="mt-1 block text-xs text-ink-subtle">
                          {item.hint}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <p className="mt-5 text-xs text-ink-subtle">
                Still stuck? Finish the checklist to unlock the email button.
              </p>
            </Card>

            {checksComplete ? (
              <div ref={stepThreeRef}>
                <Card className="trail-panel p-6 reveal">
                  <StepBadge step={3} label="Send to support" />
                  <p className="mt-3 text-sm text-ink-muted">
                    Copy diagnostics, describe the issue, then email us. Screenshots help.
                  </p>

                  <div className="mt-5 grid gap-3">
                    <label className="text-xs font-semibold tracking-[0.12em] text-ink-subtle">
                      Account email (optional)
                    </label>
                    <input
                      value={accountEmail}
                      onChange={(event) => setAccountEmail(event.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                      className="trail-input"
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-3">
                      <label className="text-xs font-semibold tracking-[0.12em] text-ink-subtle">
                        Client
                      </label>
                      <input
                        value={browserLabel}
                        readOnly
                        className="trail-input cursor-default opacity-90"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-semibold tracking-[0.12em] text-ink-subtle">
                        OS
                      </label>
                      <input
                        value={os}
                        readOnly
                        className="trail-input cursor-default opacity-90"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <label className="text-xs font-semibold tracking-[0.12em] text-ink-subtle">
                      Add-on version (optional)
                    </label>
                    <input
                      value={extensionVersion}
                      onChange={(event) => setExtensionVersion(event.target.value)}
                      placeholder="Find it in chrome://extensions"
                      className="trail-input"
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onCopyDiagnostics}
                    >
                      {copyDiagStatus === "copied"
                        ? "Copied"
                        : copyDiagStatus === "error"
                          ? "Copy failed"
                          : "Copy diagnostic info"}
                    </Button>
                    <span className="text-xs text-ink-subtle">
                      Paste into your email if you prefer.
                    </span>
                  </div>

                  <div className="mt-6 grid gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold tracking-[0.12em] text-ink-subtle">
                        What happened?
                      </label>
                      <textarea
                        value={whatHappened}
                        onChange={(event) => setWhatHappened(event.target.value)}
                        rows={3}
                        placeholder="Describe what you see (error, loop, missing capture, etc.)"
                        className="w-full rounded-3xl border border-stroke/60 bg-surface/80 px-4 py-3 text-sm text-ink shadow-inner placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold tracking-[0.12em] text-ink-subtle">
                        What you expected
                      </label>
                      <input
                        value={expected}
                        onChange={(event) => setExpected(event.target.value)}
                        placeholder="One sentence is enough"
                        className="trail-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold tracking-[0.12em] text-ink-subtle">
                        Steps to reproduce
                      </label>
                      <textarea
                        value={stepsToReproduce}
                        onChange={(event) => setStepsToReproduce(event.target.value)}
                        rows={3}
                        placeholder="1) Open… 2) Click… 3) See…"
                        className="w-full rounded-3xl border border-stroke/60 bg-surface/80 px-4 py-3 text-sm text-ink shadow-inner placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </div>
                  </div>

                  <details className="mt-5 rounded-3xl border border-stroke/50 bg-surface/70 px-5 py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                      <span className="text-sm font-semibold text-ink">
                        What we love to see (optional)
                      </span>
                      <span className="text-xs text-ink-subtle">expand</span>
                    </summary>
                    <ul className="mt-4 space-y-2 text-sm text-ink-muted">
                      {support.include.map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent/60" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </details>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button type="button" size="lg" onClick={onContactSupport} disabled={!canContactSupport}>
                      Email support
                    </Button>
                  </div>
                </Card>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-stroke/40 bg-surface/50 px-6 py-5 text-sm text-ink-subtle">
                Complete the checklist above to unlock Step 3.
              </div>
            )}
          </>
        ) : null}

        {path === "feature" ? (
          <Card className="trail-panel p-7 reveal">
            <StepBadge step={2} label="Request a feature" />
            <p className="mt-3 text-sm text-ink-muted">
              Tell us the outcome you want, what blocks you, and how often you hit this.
            </p>

            <div className="mt-6 grid gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-[0.12em] text-ink-subtle">
                  What are you trying to do?
                </label>
                <textarea
                  value={featureGoal}
                  onChange={(event) => setFeatureGoal(event.target.value)}
                  rows={3}
                  placeholder="Describe your goal (the job you are trying to get done)."
                  className="w-full rounded-3xl border border-stroke/60 bg-surface/80 px-4 py-3 text-sm text-ink shadow-inner placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-[0.12em] text-ink-subtle">
                  What blocks you today?
                </label>
                <textarea
                  value={featureBlocker}
                  onChange={(event) => setFeatureBlocker(event.target.value)}
                  rows={3}
                  placeholder="What is missing or painful right now?"
                  className="w-full rounded-3xl border border-stroke/60 bg-surface/80 px-4 py-3 text-sm text-ink shadow-inner placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold tracking-[0.12em] text-ink-subtle">
                    How often do you need this?
                  </label>
                  <select
                    value={featureFrequency}
                    onChange={(event) => setFeatureFrequency(event.target.value)}
                    className="h-11 w-full rounded-full border border-stroke/60 bg-surface px-4 text-sm text-ink shadow-inner focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="sometimes">Sometimes</option>
                    <option value="rarely">Rarely</option>
                  </select>
                </div>
                <details className="rounded-3xl border border-stroke/50 bg-surface/70 px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-ink">More context (optional)</span>
                    <span className="text-xs text-ink-subtle">expand</span>
                  </summary>
                  <textarea
                    value={featureMore}
                    onChange={(event) => setFeatureMore(event.target.value)}
                    rows={4}
                    placeholder="Links, screenshots, examples, rough mockups…"
                    className="mt-3 w-full rounded-3xl border border-stroke/60 bg-surface/80 px-4 py-3 text-sm text-ink shadow-inner placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </details>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button type="button" size="lg" onClick={onSendFeatureRequest} disabled={!featureGoal.trim() || !featureBlocker.trim()}>
                Email feature request
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={onCopyFeature}>
                {copyFeatureStatus === "copied"
                  ? "Copied"
                  : copyFeatureStatus === "error"
                    ? "Copy failed"
                    : "Copy as text"}
              </Button>
            </div>
          </Card>
        ) : null}

        {path === "faq" ? (
          <Card className="trail-panel p-7 reveal">
            <StepBadge step={2} label="Search the FAQ" />
            <p className="mt-3 text-sm text-ink-muted">
              Try keywords like "privacy", "platform", "sync", "account".
            </p>

            <div className="mt-5">
              <input
                value={faqQuery}
                onChange={(event) => setFaqQuery(event.target.value)}
                placeholder="Search FAQ…"
                className="trail-input"
              />
            </div>

            <div className="mt-6 space-y-3">
              {filteredFaq.length === 0 ? (
                <p className="text-sm text-ink-subtle">No matches. Try another keyword.</p>
              ) : (
                filteredFaq.slice(0, 6).map((item) => (
                  <FaqItem key={item.question} question={item.question} answer={item.answer} />
                ))
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button.AsChild variant="outline" size="lg">
                <a href="/faq">{support.faqCta}</a>
              </Button.AsChild>
              <Button type="button" variant="ghost" size="lg" onClick={() => setPath("bug")}>
                Still stuck? Start quick checks
              </Button>
            </div>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
