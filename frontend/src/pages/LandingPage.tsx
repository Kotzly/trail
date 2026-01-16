import { motion } from "framer-motion";
import { ArrowRight, Sparkles, ShieldCheck, Cloud } from "lucide-react";
import { Link } from "react-router-dom";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-16 pt-20 md:flex-row md:items-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="flex-1 space-y-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-ink/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/70">
            <Sparkles className="h-4 w-4" />
            Trail Cloud
          </span>
          <h1 className="font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
            The calm command center for your browsing universe.
          </h1>
          <p className="max-w-xl text-base text-slate-600">
            Sync your Trail trees across devices, unlock premium insights, and manage billing without friction.
            Trail Cloud keeps every tab cluster, note, and workspace ready for the next session.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-sand shadow-card transition hover:bg-slate"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-6 py-3 text-sm font-semibold text-ink transition hover:border-ink/50"
            >
              See pricing
            </Link>
          </div>
          <div className="flex flex-wrap gap-6 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-moss" />
              Secure sessions
            </span>
            <span className="inline-flex items-center gap-2">
              <Cloud className="h-4 w-4 text-ocean" />
              Cloud sync + billing
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative flex-1"
        >
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-glow backdrop-blur">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-ink">Workspace Pulse</h3>
                <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-ink">Pro</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { label: "Active trees", value: "18", accent: "text-ocean" },
                  { label: "Synced devices", value: "4", accent: "text-moss" },
                  { label: "Saved views", value: "12", accent: "text-coral" },
                  { label: "Focus hours", value: "32", accent: "text-gold" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-black/5 bg-sand/80 p-4">
                    <div className={`text-2xl font-semibold ${item.accent}`}>{item.value}</div>
                    <div className="text-xs text-slate-500">{item.label}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-black/5 bg-gradient-to-br from-ink to-slate p-5 text-sand">
                <div className="text-sm uppercase tracking-[0.3em] text-sand/70">Upgrade ready</div>
                <p className="mt-2 text-sm">
                  Billing links and subscription controls are wired into Trail Cloud so you can plug in Stripe
                  whenever you are ready.
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -right-12 -top-10 h-40 w-40 rounded-full bg-sky/40 blur-3xl" />
          <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-coral/30 blur-3xl" />
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          variants={fadeUp}
          className="grid gap-6 md:grid-cols-3"
        >
          {[
            {
              title: "Unified identity",
              copy: "JWT + refresh tokens with revocation keep sessions safe across devices.",
            },
            {
              title: "Flexible billing",
              copy: "Provider abstraction lets you swap from stub to Stripe with one config.",
            },
            {
              title: "Metrics-ready",
              copy: "Prometheus + structured logs give you clarity on usage and latency.",
            },
          ].map((card) => (
            <div key={card.title} className="rounded-3xl border border-black/5 bg-white/70 p-6 shadow-card">
              <h3 className="font-display text-lg font-semibold text-ink">{card.title}</h3>
              <p className="mt-3 text-sm text-slate-600">{card.copy}</p>
            </div>
          ))}
        </motion.div>
      </section>

      <section className="bg-ink text-sand">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold">Ready to plug in billing?</h2>
            <p className="mt-2 text-sm text-sand/70">
              Trail Cloud ships with a Stripe-ready stub and full webhook plumbing.
            </p>
          </div>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full bg-sand px-6 py-3 text-sm font-semibold text-ink"
          >
            Create workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
