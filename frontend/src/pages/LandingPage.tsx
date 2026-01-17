import { motion } from "framer-motion";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

type LabeledValue = { label: string; value: string };

type FeatureCard = {
  title: string;
  copy: string;
  bullets: string[];
};

type WorkflowStep = {
  title: string;
  copy: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item)) : typeof value === "string" ? [value] : [];

export default function LandingPage() {
  const { t } = useTranslation();

  const rotatingWords = asStringArray(t("landing.hero.words", { returnObjects: true }));
  const stats = asArray<LabeledValue>(t("landing.stats", { returnObjects: true }));
  const snapshotCards = asArray<LabeledValue>(t("landing.snapshot.cards", { returnObjects: true }));
  const featureCards = asArray<FeatureCard>(t("landing.features.cards", { returnObjects: true }));
  const workflowSteps = asArray<WorkflowStep>(t("landing.workflow.steps", { returnObjects: true }));
  const insightCards = asArray<LabeledValue>(t("landing.workflow.insights", { returnObjects: true }));
  const datasetList = asStringArray(t("landing.dataset.list", { returnObjects: true }));
  const subscriptionItems = asArray<LabeledValue>(t("landing.dataset.subscriptionItems", { returnObjects: true }));
  const faqItems = asArray<FaqItem>(t("landing.faq.items", { returnObjects: true }));

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
              {t("landing.hero.pill")}
            </span>
            <h1 className="font-display text-4xl font-semibold leading-tight text-ink md:text-6xl">
              <span className="block text-ink-muted">{t("landing.hero.lead")}</span>
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
            <p className="mx-auto max-w-2xl text-base text-ink-subtle">{t("landing.hero.summary")}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-surface shadow-card transition hover:bg-ink-muted"
              >
                {t("landing.hero.ctaPrimary")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-stroke/60 px-6 py-3 text-sm font-semibold text-ink transition hover:border-stroke"
              >
                {t("landing.hero.ctaSecondary")}
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
                <h3 className="font-display text-xl font-semibold text-ink">{t("landing.snapshot.title")}</h3>
                <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink">
                  {t("landing.snapshot.badge")}
                </span>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {snapshotCards.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-stroke/30 bg-base/40 p-4">
                    <div className="text-2xl font-semibold text-ink">{item.value}</div>
                    <div className="text-xs text-ink-subtle">{item.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-stroke/30 bg-base/60 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-ink-subtle">
                  {t("landing.snapshot.recapLabel")}
                </div>
                <p className="mt-2 text-sm text-ink">{t("landing.snapshot.recapText")}</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="rounded-3xl bg-ink p-6 text-surface shadow-card">
                <div className="text-xs uppercase tracking-[0.2em] text-surface/70">
                  {t("landing.focusCard.label")}
                </div>
                <div className="mt-4 text-4xl font-semibold">{t("landing.focusCard.score")}</div>
                <p className="mt-2 text-sm text-surface/70">{t("landing.focusCard.text")}</p>
              </div>
              <div className="rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card">
                <div className="text-xs uppercase tracking-[0.2em] text-ink-subtle">
                  {t("landing.subscriptionCard.label")}
                </div>
                <div className="mt-3 text-lg font-semibold text-ink">{t("landing.subscriptionCard.title")}</div>
                <p className="mt-2 text-sm text-ink-subtle">{t("landing.subscriptionCard.text")}</p>
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
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">
            {t("landing.features.eyebrow")}
          </span>
          <h2 className="font-display text-3xl font-semibold text-ink md:text-4xl">{t("landing.features.title")}</h2>
          <p className="max-w-2xl text-sm text-ink-subtle">{t("landing.features.summary")}</p>
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
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">
                {t("landing.workflow.eyebrow")}
              </span>
              <h2 className="mt-4 font-display text-3xl font-semibold text-ink md:text-4xl">
                {t("landing.workflow.title")}
              </h2>
              <p className="mt-4 max-w-xl text-sm text-ink-subtle">{t("landing.workflow.summary")}</p>
              <div className="mt-8 rounded-3xl border border-stroke/40 bg-surface/90 p-6 shadow-card">
                <div className="text-xs uppercase tracking-[0.2em] text-ink-subtle">
                  {t("landing.workflow.insightLabel")}
                </div>
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
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">
              {t("landing.dataset.eyebrow")}
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold text-ink">{t("landing.dataset.title")}</h2>
            <p className="mt-4 text-sm text-ink-subtle">{t("landing.dataset.summary")}</p>
            <div className="mt-6 grid gap-3">
              {datasetList.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-ink">
                  <Check className="h-4 w-4" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-ink p-8 text-surface shadow-card">
            <h3 className="font-display text-2xl font-semibold">{t("landing.dataset.subscriptionTitle")}</h3>
            <p className="mt-3 text-sm text-surface/70">{t("landing.dataset.subscriptionSummary")}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {subscriptionItems.map((item) => (
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
              {t("landing.dataset.subscriptionCta")}
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
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-subtle">
                {t("landing.faq.eyebrow")}
              </span>
              <h2 className="mt-4 font-display text-3xl font-semibold text-ink">{t("landing.faq.title")}</h2>
              <p className="mt-4 text-sm text-ink-subtle">{t("landing.faq.summary")}</p>
            </div>
            <div className="space-y-4">
              {faqItems.map((item) => (
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
            <h2 className="font-display text-3xl font-semibold">{t("landing.cta.title")}</h2>
            <p className="mt-2 text-sm text-surface/70">{t("landing.cta.summary")}</p>
          </div>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full bg-surface px-6 py-3 text-sm font-semibold text-ink"
          >
            {t("landing.cta.button")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
