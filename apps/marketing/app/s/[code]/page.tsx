import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  bumpSharedTrailViewCount,
  fetchSharedTrail,
} from "@/lib/shared-trail-api";
import { ImportTrailButton } from "./import-button";
import { SharedTrailTree } from "./shared-trail-tree";
import { SharedTrailAttribution } from "./shared-trail-attribution";
import { RestrictedShareGate } from "./restricted-share-gate";
import type { SharedTrailDetail } from "@/lib/shared-trail-types";

// Code-split the graph: ~80 KB gz of `@xyflow/react` + `d3-hierarchy`
// only ship on `/s/<code>`, not the marketing landing or legal pages.
const SharedTrailGraph = dynamic(
  () =>
    import("./graph/shared-trail-graph").then((m) => ({
      default: m.SharedTrailGraph,
    })),
  {
    loading: () => (
      <div className="h-[640px] w-full animate-pulse rounded-lg border bg-muted/30" />
    ),
  },
);

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

export default async function SharedTrailPage({
  params,
}: {
  params: PageParams;
}) {
  const { code } = await params;
  const result = await fetchSharedTrail(code);
  if (result.access === "missing") notFound();
  if (result.access === "restricted") {
    return (
      <RestrictedShareGate code={code} authenticated={result.authenticated} />
    );
  }
  // Record the view AFTER the response is sent so TTFB stays fast.
  // The bump is rate-limited server-side (one bump per code per hour)
  // and swallows its own errors — analytics-grade, not critical path.
  after(() => bumpSharedTrailViewCount(code));
  return <SharedTrailView detail={result.detail} />;
}

function SharedTrailView({ detail }: { detail: SharedTrailDetail }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
      <header className="flex flex-col gap-4 border-b pb-6">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Trail
        </Link>
        <SharedTrailAttribution
          owner={detail.owner}
          createdAt={detail.createdAt}
        />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {detail.label}
          </h1>
          <p className="text-sm text-muted-foreground">
            {detail.nodeCount} {detail.nodeCount === 1 ? "node" : "nodes"}
          </p>
        </div>
      </header>

      <section className="mt-6">
        <ImportTrailButton
          code={detail.code}
          label={detail.label}
          nodeCount={detail.nodeCount}
        />
      </section>

      <section className="mt-8">
        {detail.snapshot.root ? (
          <>
            <SharedTrailGraph
              root={detail.snapshot.root}
              currentNodeId={detail.snapshot.currentNodeId}
            />
            <noscript>
              <p className="mt-3 text-xs text-muted-foreground">
                JavaScript is disabled. Falling back to a flat list view.
              </p>
              <div className="mt-2">
                <SharedTrailTree root={detail.snapshot.root} />
              </div>
            </noscript>
          </>
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
