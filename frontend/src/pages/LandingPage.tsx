import { motion } from "framer-motion";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const rotatingWords = ["developers", "researchers", "product teams", "writers", "students", "everyone"];

const stats = [
  { label: "Avg. resume time", value: "3.2s" },
  { label: "Sources captured", value: "120+ / week" },
  { label: "Auto-tag accuracy", value: "94%" },
  { label: "Context preserved", value: "100%" },
];

const featureCards = [
  {
    title: "Auto-captured trails",
    copy: "Every search, doc, and decision is logged into a clean trail you can resume in seconds.",
    bullets: ["Session timeline", "Visited sources", "Time spent per page"],
  },
  {
    title: "Smart tagging",
    copy: "Trail tags pages as you browse, so you can filter by topic, client, or research thread.",
    bullets: ["Auto topic labels", "Pinned highlights", "One-click follow-ups"],
  },
  {
    title: "Shareable context",
    copy: "Send a trail instead of a tab dump. Keep the storyline, notes, and decisions intact.",
    bullets: ["Exportable summaries", "Private links", "Team-ready views"],
  },
];

const workflowSteps = [
  {
    title: "Capture",
    copy: "Trail runs as a lightweight browser extension, recording every meaningful step in your session.",
  },
  {
    title: "Curate",
    copy: "Highlight key sources, add notes, and pin the moments that matter before you move on.",
  },
  {
    title: "Resume",
    copy: "Open a trail later and you are back exactly where you left off, complete with context.",
  },
  {
    title: "Share",
    copy: "Send a trail to collaborators so they can jump into the same research path instantly.",
  },
];

const insightCards = [
  { label: "Weekly deep-work sessions", value: "18" },
  { label: "Avg. tabs per trail", value: "46" },
  { label: "Decision notes logged", value: "312" },
  { label: "Follow-ups scheduled", value: "27" },
];

const faqs = [
  {
    question: "Is Trail a cloud product?",
    answer: "No. Trail is a paid browser extension. Your subscription unlocks premium features and sync options.",
  },
  {
    question: "Does it work offline?",
    answer: "Yes. Trails are captured locally and can sync when you are back online.",
  },
  {
    question: "Can I export or share trails?",
    answer: "You can export summaries or share a private link with teammates.",
  },
  {
    question: "Is there a free plan?",
    answer: "Start free, then upgrade to unlock unlimited trails and advanced insights.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      <section className="relative">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-16 h-40 w-40 rounded-full bg-ink/5 blur-3xl" />
          <div className="absolute -right-10 top-40 h-56 w-56 rounded-full bg-ink/10 blur-3xl float-slow" />
          <div className="absolute bottom-10 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-ink/5 blur-3xl float-slower" />
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-stroke/40 bg-surface/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">
              <Sparkles className="h-4 w-4" />
              Browser extension · subscription
            </span>
            <h1 className="font-display text-4xl font-semibold leading-tight text-ink md:text-6xl">
              <span className="block text-ink-muted">the best extension for</span>
              <span className="mt-2 flex justify-center text-ink">
                <span className="word-rotator">
                  <span className="word-rotator-track">
                    {rotatingWords.map((word) => (
                      <span key={word}>{word}</span>
                    ))}
                  </span>
                </span>
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-base text-ink-subtle">
              Trail turns messy tab sessions into structured trails. Keep every decision, source, and next step in one
              place. It is a paid extension with a simple subscription when you are ready to unlock more.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-surface shadow-card transition hover:bg-ink-muted"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-stroke/60 px-6 py-3 text-sm font-semibold text-ink transition hover:border-stroke"
              >
                View pricing
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-10 grid gap-4 md:grid-cols-4"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-stroke/40 bg-surface/80 p-4 text-left">
                <div className="text-2xl font-semibold text-ink">{stat.value}</div>
                <div className="mt-1 text-xs text-ink-subtle">{stat.label}</div>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-12 grid gap-6 text-left md:grid-cols-[1.3fr_0.7fr]"
          >
            <div className="rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-ink">Session snapshot</h3>
                <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink">Live</span>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {[
                  { label: "Active trails", value: "12" },
                  { label: "Pinned sources", value: "38" },
                  { label: "Notes captured", value: "74" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-stroke/30 bg-base/40 p-4">
                    <div className="text-2xl font-semibold text-ink">{item.value}</div>
                    <div className="text-xs text-ink-subtle">{item.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-stroke/30 bg-base/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-ink-subtle">Trail recap</div>
                <p className="mt-2 text-sm text-ink">
                  6 sources reviewed · 2 decisions made · 4 next steps queued for tomorrow.
                </p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="rounded-3xl bg-ink p-6 text-surface shadow-card">
                <div className="text-xs uppercase tracking-[0.2em] text-surface/70">Focus score</div>
                <div className="mt-4 text-4xl font-semibold">92%</div>
                <p className="mt-2 text-sm text-surface/70">
                  Trail keeps context tight so you can move faster without losing the thread.
                </p>
              </div>
              <div className="rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card">
                <div className="text-xs uppercase tracking-[0.2em] text-ink-subtle">Subscription status</div>
                <div className="mt-3 text-lg font-semibold text-ink">Ready to upgrade</div>
                <p className="mt-2 text-sm text-ink-subtle">
                  Unlock unlimited trails, deeper insights, and shareable sessions.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          variants={fadeUp}
          className="flex flex-col gap-4"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">Features</span>
          <h2 className="font-display text-3xl font-semibold text-ink md:text-4xl">
            Everything you need to stay in flow.
          </h2>
          <p className="max-w-2xl text-sm text-ink-subtle">
            Trail is designed to feel invisible while you browse, but incredibly powerful when you need to pick a trail
            back up.
          </p>
        </motion.div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {featureCards.map((card) => (
            <motion.div
              key={card.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6 }}
              variants={fadeUp}
              className="rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card"
            >
              <h3 className="font-display text-xl font-semibold text-ink">{card.title}</h3>
              <p className="mt-3 text-sm text-ink-subtle">{card.copy}</p>
              <ul className="mt-5 space-y-3 text-sm text-ink">
                {card.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-ink" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="workflow" className="bg-base/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            variants={fadeUp}
            className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]"
          >
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">Workflow</span>
              <h2 className="mt-4 font-display text-3xl font-semibold text-ink md:text-4xl">
                A calm trail from search to share.
              </h2>
              <p className="mt-4 max-w-xl text-sm text-ink-subtle">
                Your session stays organized without extra clicks. Trail captures the path, helps you curate the best
                moments, and keeps everything ready for next time.
              </p>
              <div className="mt-8 rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card">
                <div className="text-xs uppercase tracking-[0.2em] text-ink-subtle">Today in Trail</div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {insightCards.map((card) => (
                    <div key={card.label} className="rounded-2xl border border-stroke/40 bg-base/50 p-4">
                      <div className="text-2xl font-semibold text-ink">{card.value}</div>
                      <div className="text-xs text-ink-subtle">{card.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-stroke/60 bg-base/60 text-sm font-semibold text-ink">
                      0{index + 1}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
                      <p className="mt-1 text-sm text-ink-subtle">{step.copy}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          variants={fadeUp}
          className="grid gap-8 md:grid-cols-[0.9fr_1.1fr]"
        >
          <div className="rounded-3xl border border-stroke/40 bg-surface/90 p-8 shadow-card">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">Data you get</span>
            <h2 className="mt-4 font-display text-3xl font-semibold text-ink">A trail is a dataset.</h2>
            <p className="mt-4 text-sm text-ink-subtle">
              Every trail captures the intent, the sources, and the decisions behind your work. Use it to report,
              onboard, or restart the next morning with zero friction.
            </p>
            <div className="mt-6 grid gap-3">
              {[
                "Source list with time spent",
                "Highlights and saved snippets",
                "Decision notes + next steps",
                "Shareable context snapshot",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-ink">
                  <Check className="h-4 w-4" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-ink p-8 text-surface shadow-card">
            <h3 className="font-display text-2xl font-semibold">One subscription, all the trails.</h3>
            <p className="mt-3 text-sm text-surface/70">
              Trail is a paid browser extension. Upgrade once, unlock unlimited trails, deeper analytics, and team-ready
              sharing.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                { label: "Unlimited trails", value: "Included" },
                { label: "Advanced filters", value: "Pro" },
                { label: "Team sharing", value: "Pro" },
                { label: "Priority support", value: "Pro" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-surface/20 bg-surface/10 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-surface/60">{item.label}</div>
                  <div className="mt-2 text-lg font-semibold">{item.value}</div>
                </div>
              ))}
            </div>
            <Link
              to="/pricing"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-surface px-6 py-3 text-sm font-semibold text-ink"
            >
              See subscription details
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      <section id="faq" className="bg-base/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            variants={fadeUp}
            className="grid gap-6 md:grid-cols-[0.8fr_1.2fr]"
          >
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">FAQ</span>
              <h2 className="mt-4 font-display text-3xl font-semibold text-ink">Questions, answered.</h2>
              <p className="mt-4 text-sm text-ink-subtle">
                Everything you need to know about Trail subscriptions and how the extension works.
              </p>
            </div>
            <div className="space-y-4">
              {faqs.map((item) => (
                <div key={item.question} className="rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card">
                  <h3 className="text-base font-semibold text-ink">{item.question}</h3>
                  <p className="mt-2 text-sm text-ink-subtle">{item.answer}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-ink text-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-3xl font-semibold">Ready to start a trail?</h2>
            <p className="mt-2 text-sm text-surface/70">
              Install the extension, start for free, and upgrade when you are ready for deeper insights.
            </p>
          </div>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full bg-surface px-6 py-3 text-sm font-semibold text-ink"
          >
            Get started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
