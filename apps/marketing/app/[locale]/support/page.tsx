import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { fetchSupportPage } from "@/lib/sanity/queries";
import { buildMetadata } from "@/lib/seo";
import { LeaveNoteButton } from "./LeaveNoteButton";

type SupportPageParams = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: SupportPageParams;
}): Promise<Metadata> {
  const { locale } = await params;
  const [page, tSeo] = await Promise.all([
    fetchSupportPage(locale),
    getTranslations({ locale, namespace: "seo" }),
  ]);

  return buildMetadata({
    title: page?.seo?.title ?? tSeo("supportTitle"),
    description: page?.seo?.description ?? tSeo("supportDescription"),
    path: "/support",
    locale,
  });
}

export default async function SupportPage({
  params,
}: {
  params: SupportPageParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [page, t] = await Promise.all([
    fetchSupportPage(locale),
    getTranslations({ locale, namespace: "support" }),
  ]);

  const title = page?.title ?? t("title");
  const description = page?.description ?? t("description");
  const statusLabel = page?.statusLabel ?? t("statusLabel");
  const statusPageUrl = page?.statusPageUrl;
  const contactEmail = page?.contactEmail ?? t("contactEmail");

  return (
    <div className="pt-20">
      <section
        className="relative mx-auto max-w-[920px]"
        style={{
          padding: "clamp(64px, 10vh, 120px) clamp(24px, 6vw, 96px) 120px",
        }}
      >
        <header className="mb-16 max-w-[640px]">
          <div
            className="font-mono uppercase mb-[22px]"
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "var(--landing-ember)",
            }}
          >
            {t("eyebrow")}
          </div>
          <h1
            className="font-serif text-[var(--landing-ink)]"
            style={{
              fontSize: "clamp(40px, 5.5vw, 72px)",
              fontWeight: 400,
              lineHeight: 0.98,
              letterSpacing: "-0.025em",
            }}
          >
            {title}
          </h1>
          {description ? (
            <p
              className="mt-7 max-w-[540px]"
              style={{
                fontSize: 17,
                lineHeight: 1.55,
                color: "rgba(246,239,225,0.65)",
              }}
            >
              {description}
            </p>
          ) : null}
        </header>

        <StatusRow
          label={statusLabel}
          href={statusPageUrl}
          statusBadge={t("statusBadge")}
        />

        <div
          className="mt-12 grid grid-cols-1 sm:grid-cols-2"
          style={{
            gap: 1,
            background: "var(--landing-line)",
            border: "1px solid var(--landing-line)",
          }}
        >
          <ContactCell
            label={t("emailLabel")}
            description={t("emailDescription")}
            href={`mailto:${contactEmail}`}
            cta={contactEmail}
          />
          <LeaveNoteButton />
        </div>
      </section>
    </div>
  );
}

function StatusRow({
  label,
  href,
  statusBadge,
}: {
  label: string;
  href?: string;
  statusBadge: string;
}) {
  const content = (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full bg-[var(--landing-ember)]"
          style={{
            boxShadow: "0 0 8px rgba(248,211,100,0.55)",
          }}
        />
        <span
          style={{
            fontSize: 14,
            color: "var(--landing-ink)",
            letterSpacing: "-0.005em",
          }}
        >
          {label}
        </span>
      </div>
      {href ? (
        <span
          className="inline-flex items-center gap-1.5 font-mono uppercase"
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "rgba(246,239,225,0.5)",
          }}
        >
          {statusBadge}
          <ArrowUpRight size={12} aria-hidden />
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block border-y border-[var(--landing-line)] py-5 transition-colors duration-200 hover:bg-[rgba(248,211,100,0.04)]"
      >
        {content}
      </a>
    );
  }
  return (
    <div className="block border-y border-[var(--landing-line)] py-5">
      {content}
    </div>
  );
}

function ContactCell({
  label,
  description,
  href,
  cta,
}: {
  label: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <a
      href={href}
      className="group relative flex flex-col bg-[var(--landing-bg)] transition-colors duration-300 hover:bg-[rgba(20,17,12,0.85)]"
      style={{ padding: "clamp(28px, 3.2vw, 44px)", minHeight: 220 }}
    >
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 11,
          letterSpacing: "0.22em",
          color: "rgba(246,239,225,0.4)",
          marginBottom: 16,
          transition: "color .4s ease",
        }}
      >
        {label}
      </div>
      <h3
        className="font-serif text-[var(--landing-ink)]"
        style={{
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          lineHeight: 1.15,
          marginBottom: 12,
        }}
      >
        {description}
      </h3>
      <span
        className="mt-auto inline-flex items-center gap-1.5 font-mono"
        style={{
          fontSize: 12,
          color: "var(--landing-ember)",
          letterSpacing: "0.04em",
        }}
      >
        {cta}
        <ArrowUpRight
          size={12}
          className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden
        />
      </span>
    </a>
  );
}
