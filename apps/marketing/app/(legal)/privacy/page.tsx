import Link from "next/link";
import { MarkdownBlocks } from "../MarkdownBlocks";
import { getLegalDoc } from "../legal-source";
import { buildMetadata } from "../../../lib/seo";

export const dynamic = "force-static";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "Learn what data is collected, how it is stored, and the choices you have to control sharing, retention, exports, and deletion requests.",
  path: "/privacy",
});

export default async function PrivacyPage() {
  const doc = await getLegalDoc("Privacy Policy");

  return (
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
            href="/terms"
            className="rounded-full border border-border-strong px-5 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary hover:border-text-tertiary"
          >
            Terms of Service
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
        <Link href="/terms" className="underline underline-offset-4 hover:text-text-secondary transition-colors">
          Terms of Service
        </Link>
        <span className="opacity-50">·</span>
        <a href="mailto:support@gettrail.net" className="underline underline-offset-4 hover:text-text-secondary transition-colors">
          Contact support
        </a>
      </div>
    </section>
  );
}
