"use client";

import * as React from "react";

import { marketingCopy } from "@trail/content";
import { Button, cn } from "@trail/ui";
import styles from "./SupportFlow.module.css";
import {
  DetailsPanel,
  FaqItem,
  PanelCard,
  SelectField,
  StatusNote,
  StepBadge,
  TextAreaField,
  TextInputField,
  TriageCard,
} from "./primitives";

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
    label: "Allow cookies for gettrail.net and app.gettrail.net",
    hint: "Strict blockers can break sign-in redirects.",
  },
  {
    id: "retry",
    label: "Log out and sign in again",
    hint: "If it loops, hard refresh first.",
  },
] as const;

const FEATURE_FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "sometimes", label: "Sometimes" },
  { value: "rarely", label: "Rarely" },
];

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

function detectBrowser(userAgent: string): {
  name: string;
  version: string | null;
} {
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
    return {
      name: "Chrome",
      version: matchVersion(/Chrom(?:e|ium)\/([0-9.]+)/),
    };
  }

  if (
    lower.includes("safari") &&
    lower.includes("version/") &&
    !lower.includes("chrome")
  ) {
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
  const [copyDiagStatus, setCopyDiagStatus] =
    React.useState<CopyStatus>("idle");
  const [copyFeatureStatus, setCopyFeatureStatus] =
    React.useState<CopyStatus>("idle");

  const [ua, setUa] = React.useState("");
  React.useEffect(() => {
    setUa(typeof navigator === "undefined" ? "" : navigator.userAgent);
  }, []);

  const browser = React.useMemo(() => detectBrowser(ua), [ua]);
  const os = React.useMemo(() => detectPlatform(ua), [ua]);
  const browserLabel = React.useMemo(() => {
    return browser.version
      ? `${browser.name} ${browser.version}`
      : browser.name;
  }, [browser]);

  const activeChecks =
    path === "account" ? QUICK_CHECKS_ACCOUNT : QUICK_CHECKS_BUG;
  const [checks, setChecks] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (path !== "bug" && path !== "account") {
      return;
    }

    const defaults =
      path === "account"
        ? Object.fromEntries(
            QUICK_CHECKS_ACCOUNT.map((item) => [item.id, false]),
          )
        : Object.fromEntries(QUICK_CHECKS_BUG.map((item) => [item.id, false]));

    setChecks(defaults);
    setCopyDiagStatus("idle");
  }, [path]);

  React.useEffect(() => {
    if (!path) {
      return;
    }
    window.requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [path]);

  const checksDoneCount = React.useMemo(() => {
    return Object.values(checks).filter(Boolean).length;
  }, [checks]);

  const checksTotal = activeChecks.length;
  const checksComplete = checksTotal > 0 && checksDoneCount === checksTotal;
  const canContactSupport =
    path === "bug" || path === "account" ? checksComplete : false;

  React.useEffect(() => {
    if (!checksComplete || (path !== "bug" && path !== "account")) {
      return;
    }
    window.requestAnimationFrame(() => {
      stepThreeRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
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
    window.location.href = encodeMailto(
      support.email,
      "Trail support",
      supportEmailBody,
    );
  };

  const onSendFeatureRequest = () => {
    if (!featureGoal.trim() || !featureBlocker.trim()) {
      return;
    }
    window.location.href = encodeMailto(
      support.email,
      "Trail feature request",
      featureEmailBody,
    );
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
    <section className={styles.section}>
      <div className={styles.head}>
        <p className={cn("trail-eyebrow")}>{support.eyebrow}</p>
        <h2 className={styles.title}>{support.title}</h2>
        <p className={styles.subtitle}>{support.subtitle}</p>
      </div>

      <div className={styles.topStack}>
        <PanelCard>
          <StepBadge step={1} label="Choose a topic" />
          <div className={styles.triageGrid}>
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
        </PanelCard>

        {path ? (
          <div className={styles.pathRow}>
            <span>
              Need human help? Email{" "}
              <a className={styles.supportMail} href={`mailto:${support.email}`}>
                {support.email}
              </a>
              .
            </span>
            <button
              type="button"
              onClick={() => setPath(null)}
              className={styles.backButton}
            >
              back
            </button>
          </div>
        ) : null}
      </div>

      <div ref={detailsRef} className={styles.detailsStack}>
        {path === "bug" || path === "account" ? (
          <>
            <PanelCard>
              <StepBadge
                step={2}
                label={
                  path === "account"
                    ? "Quick checks for account issues"
                    : "Quick checks for bugs"
                }
              />
              <div className={styles.progressRow}>
                <span>
                  {checksDoneCount}/{checksTotal} done
                </span>
                <span>takes ~30s</span>
              </div>

              <div className={styles.checkList}>
                {activeChecks.map((item) => {
                  const checked = Boolean(checks[item.id]);
                  return (
                    <label
                      key={item.id}
                      className={cn(
                        styles.checkItem,
                        checked ? styles.checkItemChecked : null,
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setChecks((prev) => ({
                            ...prev,
                            [item.id]: event.target.checked,
                          }));
                        }}
                        className={styles.checkInput}
                      />
                      <span>
                        <span className={styles.checkLabel}>{item.label}</span>
                        <span className={styles.checkHint}>{item.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <p className={styles.caption}>
                Still stuck? Finish the checklist to unlock the email button.
              </p>
            </PanelCard>

            {checksComplete ? (
              <div ref={stepThreeRef}>
                <PanelCard>
                  <StepBadge step={3} label="Send to support" />
                  <p className={styles.subtitle}>
                    Copy diagnostics, describe the issue, then email us.
                    Screenshots help.
                  </p>

                  <div className={styles.formGroup}>
                    <TextInputField
                      label="Account email (optional)"
                      value={accountEmail}
                      onChange={(event) => setAccountEmail(event.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                    />
                  </div>

                  <div className={styles.twoCols}>
                    <TextInputField
                      label="Client"
                      value={browserLabel}
                      readOnly
                    />
                    <TextInputField label="OS" value={os} readOnly />
                  </div>

                  <div className={styles.formGroup}>
                    <TextInputField
                      label="Add-on version (optional)"
                      value={extensionVersion}
                      onChange={(event) => setExtensionVersion(event.target.value)}
                      placeholder="Find it in chrome://extensions"
                    />
                  </div>

                  <div className={styles.copyRow}>
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
                    <StatusNote>Paste into your email if you prefer.</StatusNote>
                  </div>

                  <div className={styles.textGrid}>
                    <TextAreaField
                      label="What happened?"
                      value={whatHappened}
                      onChange={(event) => setWhatHappened(event.target.value)}
                      rows={3}
                      placeholder="Describe what you see (error, loop, missing capture, etc.)"
                    />

                    <TextInputField
                      label="What you expected"
                      value={expected}
                      onChange={(event) => setExpected(event.target.value)}
                      placeholder="One sentence is enough"
                    />

                    <TextAreaField
                      label="Steps to reproduce"
                      value={stepsToReproduce}
                      onChange={(event) =>
                        setStepsToReproduce(event.target.value)
                      }
                      rows={3}
                      placeholder="1) Open… 2) Click… 3) See…"
                    />
                  </div>

                  <DetailsPanel title="What we love to see (optional)">
                    <ul className={styles.detailsList}>
                      {support.include.map((item) => (
                        <li key={item} className={styles.detailsItem}>
                          <span className={styles.detailsDot} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </DetailsPanel>

                  <div className={styles.buttonRow}>
                    <Button
                      type="button"
                      size="lg"
                      onClick={onContactSupport}
                      disabled={!canContactSupport}
                    >
                      Email support
                    </Button>
                  </div>
                </PanelCard>
              </div>
            ) : (
              <div className={styles.lockedNotice}>
                Complete the checklist above to unlock Step 3.
              </div>
            )}
          </>
        ) : null}

        {path === "feature" ? (
          <PanelCard size="lg">
            <StepBadge step={2} label="Request a feature" />
            <p className={styles.subtitle}>
              Tell us the outcome you want, what blocks you, and how often you
              hit this.
            </p>

            <div className={styles.textGrid}>
              <TextAreaField
                label="What are you trying to do?"
                value={featureGoal}
                onChange={(event) => setFeatureGoal(event.target.value)}
                rows={3}
                placeholder="Describe your goal (the job you are trying to get done)."
              />

              <TextAreaField
                label="What blocks you today?"
                value={featureBlocker}
                onChange={(event) => setFeatureBlocker(event.target.value)}
                rows={3}
                placeholder="What is missing or painful right now?"
              />

              <div className={styles.twoCols}>
                <SelectField
                  label="How often do you need this?"
                  value={featureFrequency}
                  onChange={(event) => setFeatureFrequency(event.target.value)}
                  options={FEATURE_FREQUENCY_OPTIONS}
                />
                <DetailsPanel title="More context (optional)">
                  <textarea
                    value={featureMore}
                    onChange={(event) => setFeatureMore(event.target.value)}
                    rows={4}
                    placeholder="Links, screenshots, examples, rough mockups…"
                    className={cn(styles.textarea, styles.detailsTextarea)}
                  />
                </DetailsPanel>
              </div>
            </div>

            <div className={styles.buttonRow}>
              <Button
                type="button"
                size="lg"
                onClick={onSendFeatureRequest}
                disabled={!featureGoal.trim() || !featureBlocker.trim()}
              >
                Email feature request
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onCopyFeature}
              >
                {copyFeatureStatus === "copied"
                  ? "Copied"
                  : copyFeatureStatus === "error"
                    ? "Copy failed"
                    : "Copy as text"}
              </Button>
            </div>
          </PanelCard>
        ) : null}

        {path === "faq" ? (
          <PanelCard size="lg">
            <StepBadge step={2} label="Search the FAQ" />
            <p className={styles.subtitle}>
              Try keywords like &quot;privacy&quot;, &quot;platform&quot;,
              &quot;sync&quot;, &quot;account&quot;.
            </p>

            <div className={styles.faqSearch}>
              <input
                value={faqQuery}
                onChange={(event) => setFaqQuery(event.target.value)}
                placeholder="Search FAQ…"
                className="trail-input"
              />
            </div>

            <div className={styles.faqList}>
              {filteredFaq.length === 0 ? (
                <p className={styles.faqEmpty}>No matches. Try another keyword.</p>
              ) : (
                filteredFaq
                  .slice(0, 6)
                  .map((item) => (
                    <FaqItem
                      key={item.question}
                      question={item.question}
                      answer={item.answer}
                    />
                  ))
              )}
            </div>

            <div className={styles.buttonRow}>
              <Button.AsChild variant="outline" size="lg">
                <a href="/faq">{support.faqCta}</a>
              </Button.AsChild>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => setPath("bug")}
              >
                Still stuck? Start quick checks
              </Button>
            </div>
          </PanelCard>
        ) : null}
      </div>
    </section>
  );
}
