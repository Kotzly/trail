import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/auth";
import { getTrailById } from "@/src/server/trails";
import { Button } from "@/components/ui/button";

export default async function TrailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  if (!session?.user) redirect("/auth");

  const { id } = await params;
  const trail = await getTrailById(id);
  if (!trail) notFound();

  const savedDate = new Date(trail.savedAt);
  const createdDate = new Date(trail.createdAt);
  const updatedDate = new Date(trail.updatedAt);

  return (
    <section className="space-y-6">
      {/* Back link */}
      <Link
        href="/trails"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        back to trails
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            {trail.rootFavicon ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={trail.rootFavicon}
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 shrink-0 rounded-sm"
              />
            ) : null}
            <h1 className="truncate text-xl font-semibold">{trail.label}</h1>
          </div>
          {trail.rootTitle && (
            <p className="truncate text-sm text-muted-foreground">
              {trail.rootTitle}
            </p>
          )}
        </div>

        <Button
          asChild
          size="sm"
          className="shrink-0"
        >
          <Link href={`/trails/${trail.id}/edit`}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1.5"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            Edit in Extension
          </Link>
        </Button>
      </div>

      {/* Metadata grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <MetaCard label="Nodes" value={String(trail.nodeCount)} />
        <MetaCard
          label="Root URL"
          value={trail.rootUrl ?? "—"}
          href={trail.rootUrl ?? undefined}
        />
        <MetaCard label="Saved" value={formatFull(savedDate)} />
        <MetaCard label="Created" value={formatFull(createdDate)} />
        <MetaCard label="Last updated" value={formatFull(updatedDate)} />
        <MetaCard
          label="Label source"
          value={trail.labelSource}
        />
      </div>
    </section>
  );
}

function MetaCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block truncate text-sm text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground"
        >
          {value}
        </a>
      ) : (
        <p className="mt-1 truncate text-sm text-foreground">{value}</p>
      )}
    </div>
  );
}

function formatFull(date: Date): string {
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
