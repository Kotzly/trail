import type { Metadata } from "next";
import {
  Mail,
  MessageCircle,
  Send,
  ExternalLink,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import type { ComponentType } from "react";
import { fetchSupportPage } from "../../lib/sanity/queries";
import { buildMetadata } from "../../lib/seo";
import { Reveal } from "../components/ui/reveal";

const ICON_MAP: Record<string, ComponentType<{ size?: number }>> = {
  Mail,
  MessageCircle,
  Send,
  ExternalLink,
  Activity,
};

function resolveIcon(name?: string | null) {
  if (!name || !(name in ICON_MAP)) return Mail;
  return ICON_MAP[name];
}

type SupportPageData = {
  title?: string;
  description?: string;
  seo?: { title?: string; description?: string; ogImage?: unknown };
  statusPageUrl?: string;
  statusLabel?: string;
  contactEmail?: string;
  contactChannels?: {
    label: string;
    description?: string;
    href: string;
    icon?: string;
  }[];
};

const fallback = {
  title: "Support",
  description:
    "Need help with Trail? Check our service status or reach out to the team.",
  seo: {
    title: "Support – Trail",
    description:
      "Get help with Trail. Check service status and contact our support team.",
  },
  statusLabel: "All systems operational",
  contactEmail: "support@gettrail.net",
};

export async function generateMetadata(): Promise<Metadata> {
  const page: SupportPageData | null = await fetchSupportPage();

  return buildMetadata({
    title: page?.seo?.title ?? fallback.seo.title,
    description: page?.seo?.description ?? fallback.seo.description,
    path: "/support",
  });
}

export default async function SupportPage() {
  const page: SupportPageData | null = await fetchSupportPage();

  const title = page?.title ?? fallback.title;
  const description = page?.description ?? fallback.description;
  const statusLabel = page?.statusLabel ?? fallback.statusLabel;
  const statusPageUrl = page?.statusPageUrl;
  const contactEmail = page?.contactEmail ?? fallback.contactEmail;
  const channels = page?.contactChannels;

  return (
    <section className="relative mx-auto max-w-3xl px-6 pb-24 pt-32">
      {/* Hero */}
      <Reveal>
        <div className="text-center">
          <span className="inline-block text-xs font-medium uppercase tracking-widest text-text-tertiary">
            Support
          </span>
          <h1 className="mt-4 font-serif text-4xl italic leading-tight text-text-primary md:text-5xl">
            {title}
          </h1>
          {description && (
            <p className="mx-auto mt-4 max-w-lg text-base text-text-secondary leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </Reveal>

      {/* Status Banner */}
      <Reveal delay={0.1}>
        <div className="mt-12">
          {statusPageUrl ? (
            <a
              href={statusPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-2xl border border-border-subtle bg-surface px-6 py-4 transition-colors hover:border-border-strong"
            >
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-sm font-medium text-text-primary">
                  {statusLabel}
                </span>
              </div>
              <span className="flex items-center gap-1 text-xs text-text-tertiary transition-colors group-hover:text-text-secondary">
                Status page
                <ArrowUpRight size={12} />
              </span>
            </a>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface px-6 py-4">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-sm font-medium text-text-primary">
                {statusLabel}
              </span>
            </div>
          )}
        </div>
      </Reveal>

      {/* Contact Section */}
      <Reveal delay={0.2}>
        <div className="mt-12">
          <h2 className="text-center text-xs font-medium uppercase tracking-widest text-text-tertiary">
            Get in touch
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {/* Email card — always visible */}
            <ContactCard
              icon={Mail}
              label="Email"
              description="Send us a message and we'll get back to you"
              href={`mailto:${contactEmail}`}
              cta={contactEmail}
            />

            {/* CMS-driven channels */}
            {channels?.map((ch) => {
              const Icon = resolveIcon(ch.icon);
              return (
                <ContactCard
                  key={ch.href}
                  icon={Icon}
                  label={ch.label}
                  description={ch.description}
                  href={ch.href}
                  cta={ch.label}
                  external={
                    ch.href.startsWith("http") ||
                    ch.href.startsWith("tg:")
                  }
                />
              );
            })}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function ContactCard({
  icon: Icon,
  label,
  description,
  href,
  cta,
  external,
}: {
  icon: ComponentType<{ size?: number }>;
  label: string;
  description?: string;
  href: string;
  cta: string;
  external?: boolean;
}) {
  const isExternal =
    external ?? (href.startsWith("http") || href.startsWith("mailto:"));

  const Tag = isExternal ? "a" : "a";
  const extraProps = isExternal
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <Tag
      href={href}
      {...extraProps}
      className="group flex flex-col rounded-2xl border border-border-subtle bg-surface p-6 transition-colors hover:border-border-strong"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-subtle bg-elevated text-text-secondary transition-colors group-hover:text-text-primary group-hover:border-border-strong">
        <Icon size={18} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-text-primary">{label}</h3>
      {description && (
        <p className="mt-1 text-sm leading-relaxed text-text-tertiary">
          {description}
        </p>
      )}
      <span className="mt-auto flex items-center gap-1 pt-4 text-xs font-medium text-text-secondary transition-colors group-hover:text-text-primary">
        {cta}
        <ArrowUpRight
          size={12}
          className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </span>
    </Tag>
  );
}
