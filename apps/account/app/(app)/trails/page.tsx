import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/auth";
import { getTrailsList, type TrailSummary } from "@/src/server/trails";

export default async function TrailsPage() {
  const session = await getAuthSession();
  if (!session?.user) redirect("/auth");

  const data = await getTrailsList({ limit: 50 });
  const trails = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">trails</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount > 0
              ? `${totalCount} saved trail${totalCount === 1 ? "" : "s"}`
              : "saved trails captured by your extension"}
          </p>
        </div>
      </div>

      {trails.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {trails.map((trail) => (
            <TrailCard key={trail.id} trail={trail} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </section>
  );
}

function TrailCard({ trail }: { trail: TrailSummary }) {
  return (
    <Link
      href={`/trails/${trail.id}`}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {trail.rootFavicon ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={trail.rootFavicon}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4 shrink-0 rounded-sm"
            />
          ) : (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] text-muted-foreground">
              ●
            </span>
          )}
          <span className="truncate text-sm font-medium">{trail.label}</span>
        </div>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
          {trail.nodeCount} node{trail.nodeCount === 1 ? "" : "s"}
        </span>
      </div>

      {trail.rootTitle && (
        <p className="truncate text-xs text-muted-foreground">
          {trail.rootTitle}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <time dateTime={trail.savedAt}>{formatRelative(trail.savedAt)}</time>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <div className="space-y-2">
        <p className="text-sm font-medium">no trails yet</p>
        <p className="text-sm text-muted-foreground">
          start browsing in the extension and your trails will appear here automatically.
        </p>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 0) {
    // Future date (e.g. clock skew) — show absolute date
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  }

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}
