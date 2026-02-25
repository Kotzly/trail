import Link from "next/link";
import { getTrailsList, type TrailSummary } from "@/src/server/trails";
import { TrailsClient } from "./trails-client";

export default async function TrailsPage() {
  const data = await getTrailsList({ limit: 50 });
  const trails = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Trails</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount > 0
              ? `${totalCount} saved trail${totalCount === 1 ? "" : "s"}`
              : "Saved trails captured by your extension"}
          </p>
        </div>
        <Link
          href="/trails/import"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Import
        </Link>
      </div>

      <TrailsClient trails={trails} />
    </section>
  );
}
