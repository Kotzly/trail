"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  Mail,
  Sparkles,
} from "lucide-react";
import { FaBrave } from "react-icons/fa6";
import { FaChrome, FaEdge, FaFirefoxBrowser, FaSafari } from "react-icons/fa";
import { Button, WaitlistSuccessDialog } from "@trail/ui";
import { GlowingEffect } from "../components/ui/glowing-effect";
import {
  HeroBadge,
  HeroSubtitle,
  HeroTitle,
  IconChip,
  MarketingPageShell,
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../shared/marketing-primitives";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const browsers = [
  {
    id: "chrome",
    name: "Chrome",
    icon: FaChrome,
    status: "available",
    color: "#4285F4",
  },
  {
    id: "brave",
    name: "Brave",
    icon: FaBrave,
    status: "available",
    color: "#FF4500",
  },
  {
    id: "edge",
    name: "Edge",
    icon: FaEdge,
    status: "available",
    color: "#0078D4",
  },
  {
    id: "firefox",
    name: "Firefox",
    icon: FaFirefoxBrowser,
    status: "waitlist",
    color: "#FF7139",
  },
  {
    id: "safari",
    name: "Safari",
    icon: FaSafari,
    status: "waitlist",
    color: "#006CFF",
  },
] as const;

const onboardingSteps = [
  {
    icon: Download,
    title: "Install the extension",
    description: "One-click install from the Chrome Web Store or Edge Add-ons.",
  },
  {
    icon: CheckCircle2,
    title: "Grant permissions",
    description:
      "Allow Trail to capture your browsing journey. Privacy-first, always.",
  },
  {
    icon: Sparkles,
    title: "Start capturing",
    description: "Begin researching. Trail automatically organizes your path.",
  },
];

const requirementItems = [
  "Chrome 90+ or Edge 90+",
  "macOS 10.15+, Windows 10+, or Linux",
  "2GB RAM minimum",
  "Active internet connection for sync",
];

const includedItems = [
  "Automatic path capture",
  "Notes and highlights",
  "Export to Markdown/PDF",
  "7-day history (Free plan)",
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function BrowserCard({
  browser,
  isDetected,
}: {
  browser: (typeof browsers)[number];
  isDetected: boolean;
}) {
  const Icon = browser.icon;
  const isAvailable = browser.status === "available";

  return (
    <motion.div variants={itemVariants}>
      <SurfaceCard
        className={
          isDetected
            ? "group relative p-6 shadow-lg shadow-accent/10"
            : "group relative p-6"
        }
      >
        {isDetected ? (
          <GlowingEffect
            spread={30}
            glow={true}
            disabled={false}
            proximity={40}
            inactiveZone={0.01}
            borderWidth={2}
          />
        ) : null}

        <div className="relative">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${browser.color}15` }}
          >
            <Icon className="h-7 w-7" style={{ color: browser.color }} />
          </div>

          <h3 className="mt-4 text-lg font-semibold text-ink">{browser.name}</h3>

          <div className="mt-2 flex items-center gap-2">
            <span
              className={
                isAvailable
                  ? "inline-flex h-2 w-2 rounded-full bg-green-500"
                  : "inline-flex h-2 w-2 rounded-full bg-amber-500"
              }
            />
            <span className="text-xs text-ink-subtle">
              {isAvailable ? "Available now" : "Waitlist"}
            </span>
          </div>

          {isDetected ? (
            <span className="absolute -right-2 -top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-cta-fg">
              Detected
            </span>
          ) : null}

          <div className="mt-4">
            {isAvailable ? (
              <Button className="w-full">Install Now</Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  document.getElementById("waitlist")?.scrollIntoView({
                    behavior: "smooth",
                  });
                }}
              >
                Join Waitlist
              </Button>
            )}
          </div>
        </div>
      </SurfaceCard>
    </motion.div>
  );
}

function WaitlistCard({
  email,
  status,
  error,
  onEmailChange,
  onSubmit,
}: {
  email: string;
  status: "idle" | "submitting" | "success" | "error";
  error: string | null;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const trimmedEmail = email.trim();

  return (
    <SurfaceCard className="relative overflow-hidden bg-surface/70 p-8 md:p-12">
      <GlowingEffect
        spread={60}
        glow={true}
        disabled={false}
        proximity={80}
        inactiveZone={0.01}
        borderWidth={2}
      />

      <section id="waitlist" className="relative text-center">
        <IconChip accent className="mx-auto h-14 w-14">
          <Mail className="h-7 w-7" />
        </IconChip>

        <h2 className="mt-6 text-2xl font-semibold text-ink md:text-3xl">
          Firefox or Safari user?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-ink-muted">
          We&apos;re working on support for your browser. Join the waitlist and
          be the first to know when it&apos;s ready.
        </p>

        <AnimatePresence mode="wait">
          {status === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="mt-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-4"
            >
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">You&apos;re on the list!</span>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={onSubmit}
              className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center"
            >
              <div className="relative w-full max-w-sm">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  placeholder="Enter your email"
                  className="h-12 w-full rounded-full border border-stroke/60 bg-surface px-6 text-sm text-ink placeholder:text-ink-subtle transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                  disabled={status === "submitting"}
                />
                <AnimatePresence>
                  {error ? (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute -bottom-6 left-4 text-xs text-red-500"
                    >
                      {error}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </div>
              <Button
                type="submit"
                disabled={status === "submitting" || !trimmedEmail}
                className="inline-flex items-center gap-2"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    Join Waitlist
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </section>
    </SurfaceCard>
  );
}

export function DownloadsContent() {
  const [detectedBrowser, setDetectedBrowser] = useState("chrome");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("firefox")) setDetectedBrowser("firefox");
    else if (ua.includes("edg/")) setDetectedBrowser("edge");
    else if (ua.includes("chrome")) setDetectedBrowser("chrome");
    else if (ua.includes("safari")) setDetectedBrowser("safari");
  }, []);

  const trimmedEmail = email.trim();
  const isEmailValid = emailPattern.test(trimmedEmail);

  const onSubmitWaitlist = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isEmailValid) {
      setError("Please enter a valid email address.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, source: "downloads-page" }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          setStatus("success");
          setShowSuccessDialog(true);
          return;
        }
        throw new Error("Failed to join waitlist");
      }

      setStatus("success");
      setShowSuccessDialog(true);
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <MarketingPageShell>
      <PageSection spacing="hero" className="pb-16">
        <SectionContainer size="lg">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center"
          >
            <motion.div variants={itemVariants}>
              <HeroBadge>
                <Download className="h-3.5 w-3.5" />
                Get Started
              </HeroBadge>
            </motion.div>
            <motion.div variants={itemVariants}>
              <HeroTitle>Install Trail in seconds</HeroTitle>
            </motion.div>
            <motion.div variants={itemVariants}>
              <HeroSubtitle>
                Available for Chrome and Edge. Join the waitlist for Firefox and
                Safari.
              </HeroSubtitle>
            </motion.div>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {browsers.map((browser) => (
              <BrowserCard
                key={browser.id}
                browser={browser}
                isDetected={detectedBrowser === browser.id}
              />
            ))}
          </motion.div>
        </SectionContainer>
      </PageSection>

      <PageSection spacing="spacious">
        <SectionContainer size="lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">
              How it works
            </span>
            <h2 className="mt-4 text-2xl font-semibold text-ink md:text-3xl">
              Three steps to better research
            </h2>
          </motion.div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {onboardingSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <SurfaceCard className="p-6">
                    <IconChip accent>
                      <Icon className="h-6 w-6" />
                    </IconChip>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                        {index + 1}
                      </span>
                      <h3 className="font-semibold text-ink">{step.title}</h3>
                    </div>
                    <p className="mt-2 text-sm text-ink-muted">{step.description}</p>
                  </SurfaceCard>
                </motion.div>
              );
            })}
          </div>
        </SectionContainer>
      </PageSection>

      <PageSection spacing="spacious">
        <SectionContainer size="md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <WaitlistCard
              email={email}
              status={status}
              error={error}
              onEmailChange={(value) => {
                setEmail(value);
                if (status === "error") {
                  setStatus("idle");
                  setError(null);
                }
              }}
              onSubmit={onSubmitWaitlist}
            />
          </motion.div>
        </SectionContainer>
      </PageSection>

      <PageSection spacing="spacious">
        <SectionContainer size="lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid gap-8 lg:grid-cols-2"
          >
            <SurfaceCard className="p-6">
              <h3 className="text-lg font-semibold text-ink">System Requirements</h3>
              <ul className="mt-4 space-y-3">
                {requirementItems.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-ink-muted">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </SurfaceCard>

            <SurfaceCard className="p-6">
              <h3 className="text-lg font-semibold text-ink">What&apos;s Included</h3>
              <ul className="mt-4 space-y-3">
                {includedItems.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-ink-muted">
                    <Sparkles className="h-4 w-4 flex-shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </SurfaceCard>
          </motion.div>
        </SectionContainer>
      </PageSection>

      <WaitlistSuccessDialog
        open={showSuccessDialog}
        onClose={() => {
          setShowSuccessDialog(false);
          setEmail("");
          setStatus("idle");
        }}
        email={email}
      />
    </MarketingPageShell>
  );
}
