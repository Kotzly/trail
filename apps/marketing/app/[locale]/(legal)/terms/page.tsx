import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { MarkdownBlocks } from "../MarkdownBlocks";
import { getLegalDoc } from "../legal-source";
import { buildMetadata } from "@/lib/seo";
import { SiteChrome } from "@/app/components/SiteChrome";

export const dynamic = "force-static";

type TermsPageParams = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: TermsPageParams;
}) {
  const { locale } = await params;
  return buildMetadata({
    title: "Terms of Service",
    description:
      "Review responsibilities, acceptable use, billing, and how the product is provided, including updates, suspension, and termination.",
    path: "/terms",
    locale,
  });
}

export default async function TermsPage({
  params,
}: {
  params: TermsPageParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const doc = await getLegalDoc("Terms of Service");

  return (
    <SiteChrome locale={locale}>
      <section className="relative mx-auto max-w-3xl px-6 pb-24 pt-32">
        <div className="text-center">
          <span className="inline-block text-xs font-medium uppercase tracking-widest text-text-tertiary">
            Legal
          </span>
          <h1 className="mt-4 font-serif text-4xl italic leading-tight text-text-primary md:text-5xl">
            {doc.title}
          </h1>
          {doc.lastUpdated && (
            <p className="mt-3 text-sm text-text-tertiary">
              Last updated: {doc.lastUpdated}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/privacy"
              className="rounded-full border border-border-strong px-5 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary hover:border-text-tertiary"
            >
              Privacy Policy
            </Link>
            <a
              href="mailto:support@gettrail.net"
              className="rounded-full px-5 py-2 text-sm text-text-tertiary transition-colors hover:text-text-secondary"
            >
              support@gettrail.net
            </a>
          </div>
        </div>

        <div className="mt-12 rounded-2xl border border-border-subtle bg-surface p-7 md:p-10">
          <MarkdownBlocks markdown={doc.markdown} />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-text-tertiary">
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-text-secondary transition-colors"
          >
            Privacy Policy
          </Link>
          <span className="opacity-50">·</span>
          <a
            href="mailto:support@gettrail.net"
            className="underline underline-offset-4 hover:text-text-secondary transition-colors"
          >
            Contact support
          </a>
        </div>
      </section>
    </SiteChrome>
  );
}
