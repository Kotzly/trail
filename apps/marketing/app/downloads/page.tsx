"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Download, 
  CheckCircle2, 
  Mail,
  ArrowRight,
  Sparkles,
  Loader2
} from "lucide-react";

import { FaChrome, FaEdge, FaFirefoxBrowser, FaSafari } from "react-icons/fa";
import { FaBrave } from "react-icons/fa6";

import { BackgroundArt, Button, WaitlistSuccessDialog } from "@trail/ui";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";
import { GlowingEffect } from "../components/ui/glowing-effect";
import { DownloadsLoading } from "../components/page-wrapper";

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
  { id: "chrome", name: "Chrome", icon: FaChrome, status: "available", color: "#4285F4" },
  { id: "brave", name: "Brave", icon: FaBrave, status: "available", color: "#FF4500" },
  { id: "edge", name: "Edge", icon: FaEdge, status: "available", color: "#0078D4" },
  { id: "firefox", name: "Firefox", icon: FaFirefoxBrowser, status: "waitlist", color: "#FF7139" },
  { id: "safari", name: "Safari", icon: FaSafari, status: "waitlist", color: "#006CFF" },
];

const steps = [
  {
    icon: Download,
    title: "Install the extension",
    description: "One-click install from the Chrome Web Store or Edge Add-ons.",
  },
  {
    icon: CheckCircle2,
    title: "Grant permissions",
    description: "Allow Trail to capture your browsing journey. Privacy-first, always.",
  },
  {
    icon: Sparkles,
    title: "Start capturing",
    description: "Begin researching. Trail automatically organizes your path.",
  },
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function DownloadsContent() {
  const [detectedBrowser, setDetectedBrowser] = useState<string>("chrome");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEmailValid) {
      setError("Please enter a valid email address.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setError(null);

    try {
      // todo: move to proper api endpoint
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, source: "downloads-page" }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          // Already on the list
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

  const handleCloseDialog = () => {
    setShowSuccessDialog(false);
    setEmail("");
    setStatus("idle");
  };

  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="relative overflow-hidden">
        <BackgroundArt variant="grid" className="opacity-50" />
        
        {/* Hero */}
        <section className="relative px-6 pt-20 pb-16">
          <div className="mx-auto max-w-6xl">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="text-center"
            >
              <motion.span
                variants={itemVariants}
                className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-accent"
              >
                <Download className="h-3.5 w-3.5" />
                Get Started
              </motion.span>
              
              <motion.h1
                variants={itemVariants}
                className="mt-6 font-display text-4xl font-semibold leading-[1.15] tracking-tight text-ink md:text-5xl lg:text-6xl"
              >
                Install Trail in seconds
              </motion.h1>
              
              <motion.p
                variants={itemVariants}
                className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted"
              >
                Available for Chrome and Edge. Join the waitlist for Firefox and Safari.
              </motion.p>
            </motion.div>

            {/* Browser Cards */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              {browsers.map((browser) => {
                const Icon = browser.icon;
                const isDetected = detectedBrowser === browser.id;
                const isAvailable = browser.status === "available";
                
                return (
                  <motion.div
                    key={browser.id}
                    variants={itemVariants}
                    className={`group relative rounded-3xl border p-6 transition-all duration-300 ${
                      isDetected
                        ? "border-accent/50 bg-surface/80 shadow-lg shadow-accent/10"
                        : "border-stroke/40 bg-surface/50 hover:border-accent/30 hover:bg-surface/70"
                    }`}
                  >
                    {isDetected && (
                      <GlowingEffect
                        spread={30}
                        glow={true}
                        disabled={false}
                        proximity={40}
                        inactiveZone={0.01}
                        borderWidth={2}
                      />
                    )}
                    
                    <div className="relative">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: `${browser.color}15` }}
                      >
                        <Icon
                          className="h-7 w-7"
                          style={{ color: browser.color }}
                        />
                      </div>
                      
                      <h3 className="mt-4 text-lg font-semibold text-ink">
                        {browser.name}
                      </h3>
                      
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`inline-flex h-2 w-2 rounded-full ${
                            isAvailable
                              ? "bg-green-500"
                              : browser.status === "waitlist"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                          }`}
                        />
                        <span className="text-xs text-ink-subtle capitalize">
                          {browser.status === "available" ? "Available now" : browser.status}
                        </span>
                      </div>

                      {isDetected && (
                        <span className="absolute -right-2 -top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-cta-fg">
                          Detected
                        </span>
                      )}

                      <div className="mt-4">
                        {isAvailable ? (
                          <Button className="w-full">
                            Install Now
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            className="w-full" 
                            onClick={() => {
                              const element = document.getElementById("waitlist");
                              element?.scrollIntoView({ behavior: "smooth" });
                            }}
                          >
                            Join Waitlist
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* How it works */}
        <section className="relative px-6 py-16">
          <div className="mx-auto max-w-6xl">
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
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="relative rounded-3xl border border-stroke/40 bg-surface/50 p-6"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
                      <Icon className="h-6 w-6 text-accent" />
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                        {index + 1}
                      </span>
                      <h3 className="font-semibold text-ink">{step.title}</h3>
                    </div>
                    <p className="mt-2 text-sm text-ink-muted">
                      {step.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Waitlist CTA */}
        <section className="relative px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative overflow-hidden rounded-3xl border border-stroke/40 bg-surface/70 p-8 md:p-12"
            >
              <GlowingEffect
                spread={60}
                glow={true}
                disabled={false}
                proximity={80}
                inactiveZone={0.01}
                borderWidth={2}
              />
              
              <section id="waitlist">
                <div className="relative text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                    <Mail className="h-7 w-7 text-accent" />
                  </div>
                  
                  <h2 className="mt-6 text-2xl font-semibold text-ink md:text-3xl">
                    Firefox or Safari user?
                  </h2>
                  <p className="mx-auto mt-3 max-w-lg text-ink-muted">
                    We&apos;re working on support for your browser. Join the waitlist and be the first to know when it&apos;s ready.
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
                          <span className="font-medium">You&apos;re on the list! Check your email.</span>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.form
                        key="form"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onSubmit={handleSubmit}
                        className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center"
                      >
                        <div className="relative flex-1 max-w-sm">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              if (status === "error") {
                                setStatus("idle");
                                setError(null);
                              }
                            }}
                            placeholder="Enter your email"
                            className="h-12 w-full rounded-full border border-stroke/60 bg-surface px-6 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
                            disabled={status === "submitting"}
                          />
                          <AnimatePresence>
                            {error && (
                              <motion.p
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute -bottom-6 left-4 text-xs text-red-500"
                              >
                                {error}
                              </motion.p>
                            )}
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
                </div>
              </section>
            </motion.div>
          </div>
        </section>

        {/* System Requirements */}
        <section className="relative px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="grid gap-8 lg:grid-cols-2"
            >
              <div className="rounded-3xl border border-stroke/40 bg-surface/50 p-6">
                <h3 className="text-lg font-semibold text-ink">System Requirements</h3>
                <ul className="mt-4 space-y-3">
                  {[
                    "Chrome 90+ or Edge 90+",
                    "macOS 10.15+, Windows 10+, or Linux",
                    "2GB RAM minimum",
                    "Active internet connection for sync",
                  ].map((req, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-ink-muted">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-accent" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl border border-stroke/40 bg-surface/50 p-6">
                <h3 className="text-lg font-semibold text-ink">What&apos;s Included</h3>
                <ul className="mt-4 space-y-3">
                  {[
                    "Automatic path capture",
                    "Notes and highlights",
                    "Export to Markdown/PDF",
                    "7-day history (Free plan)",
                  ].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-ink-muted">
                      <Sparkles className="h-4 w-4 flex-shrink-0 text-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <MarketingFooter />

      {/* Success Dialog */}
      <WaitlistSuccessDialog
        open={showSuccessDialog}
        onClose={handleCloseDialog}
        email={email}
      />
    </div>
  );
}

export default function DownloadsPage() {
  return (
    <Suspense fallback={<DownloadsLoading />}>
      <DownloadsContent />
    </Suspense>
  );
}
