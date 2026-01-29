import type { Metadata } from "next";
import Link from "next/link";

import { Badge, Button, Card } from "@trail/ui";
import { LegalPageShell } from "../LegalPageShell";
import { MarkdownBlocks } from "../MarkdownBlocks";
import { getLegalDoc } from "../legal-source";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "terms of service · trail",
  description: "The terms for using trail and our services.",
};

export default async function TermsPage() {
  const doc = await getLegalDoc("Terms of Service");

  return (
    <LegalPageShell variant="graph">
      <section className="relative mx-auto max-w-5xl px-6 pb-16 pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="trail-eyebrow border border-stroke/40 bg-surface/70">
            legal
          </Badge>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
            {doc.title}
          </h1>
          {doc.lastUpdated ? (
            <p className="mt-3 text-sm text-ink-subtle">Last updated: {doc.lastUpdated}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/privacy">Read privacy</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href="mailto:support@gettrail.net">support@gettrail.net</a>
            </Button>
          </div>
        </div>

        <Card className="trail-panel relative mt-10 p-7 md:p-10">
          <MarkdownBlocks markdown={doc.markdown} />
        </Card>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-ink-subtle">
          <Link href="/support" className="underline underline-offset-4">
            Contact support
          </Link>
          <span className="opacity-70">·</span>
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
        </div>
      </section>
    </LegalPageShell>
  );
}

