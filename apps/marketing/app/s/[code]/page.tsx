import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import Link from "next/link";
import {
  bumpSharedTrailViewCount,
  fetchSharedTrail,
} from "@/lib/shared-trail-api";
import { Button } from "@/app/components/ui/button";
import { INSTALL_URL } from "@/lib/install-url";
import { ImportTrailButton } from "./import-button";
import { SharedTrailTree } from "./shared-trail-tree";
import type { SharedTrailDetail } from "@/lib/shared-trail-types";

type PageParams = Promise<{ code: string }>;

/**
 * Generic, non-content-leaking metadata. Per premortem #14.3, never
 * surface trail content (titles/URLs) in OG so anyone with the link
 * doesn't see what's inside via Slack/Twitter unfurl bots.
 */
export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: "A trail on Trail",
    description: "Someone shared a browsing trail with you. View it on Trail.",
    alternates: { canonical: `https://gettrail.net/s/${code}` },
    openGraph: {
      title: "A trail on Trail",
      description: "Someone shared a browsing trail with you.",
      type: "website",
    },
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false, noimageindex: true },
    },
    referrer: "no-referrer",
  };
}

const SHARE_IMPORT_ENABLED =
  process.env.NEXT_PUBLIC_SHARE_IMPORT_ENABLED === "true";

export default async function SharedTrailPage({
  params,
}: {
  params: PageParams;
}) {
  const { code } = await params;
  const detail = await fetchSharedTrail(code);
  if (!detail) notFound();
  // Record the view AFTER the response is sent so TTFB stays fast.
  // The bump is rate-limited server-side (one bump per code per hour)
  // and swallows its own errors — analytics-grade, not critical path.
  after(() => bumpSharedTrailViewCount(code));
  return (
    <SharedTrailView detail={detail} importEnabled={SHARE_IMPORT_ENABLED} />
  );
}

function SharedTrailView({
  detail,
  importEnabled,
}: {
  detail: SharedTrailDetail;
  importEnabled: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
      <header className="flex flex-col gap-1 border-b pb-6">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Trail
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {detail.label}
        </h1>
        <p className="text-sm text-muted-foreground">
          {detail.nodeCount} {detail.nodeCount === 1 ? "node" : "nodes"} ·{" "}
          {new Date(detail.createdAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      </header>

      <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {importEnabled ? (
          <ImportTrailButton code={detail.code} />
        ) : (
          <Button asChild variant="outline">
            <a href={INSTALL_URL} target="_blank" rel="noopener noreferrer">
              Install Trail to import
            </a>
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          Imports a copy into your own Trail. The owner can revoke the link
          anytime; your imported copy is unaffected.
        </p>
      </section>

      <section className="mt-8">
        {detail.snapshot.root ? (
          <SharedTrailTree root={detail.snapshot.root} />
        ) : (
          <p className="text-sm text-muted-foreground">
            This trail has no nodes.
          </p>
        )}
      </section>

      <footer className="mt-auto pt-12 text-xs text-muted-foreground">
        Made with{" "}
        <Link href="/" className="underline-offset-2 hover:underline">
          Trail
        </Link>{" "}
        · A browser extension that draws a map of your browsing.
      </footer>
    </main>
  );
}
