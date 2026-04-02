import { getAuthSession } from "@/src/lib/auth";
import { db } from "@trail/db";
import { TreePine } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Activity",
};

type TrailRow = {
  id: string;
  label: string | null;
  node_count: number | null;
  root_url: string | null;
  root_favicon: string | null;
  updated_at: string;
  deleted_at: string | null;
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateHeading(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function groupByDate(trails: TrailRow[]): Array<{ date: string; items: TrailRow[] }> {
  const groups = new Map<string, TrailRow[]>();
  for (const trail of trails) {
    const day = trail.updated_at.slice(0, 10);
    const existing = groups.get(day);
    if (existing) {
      existing.push(trail);
    } else {
      groups.set(day, [trail]);
    }
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}

function TrailItem({ trail }: { trail: TrailRow }) {
  const isArchived = trail.deleted_at !== null;
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 shrink-0">
        {trail.root_favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={trail.root_favicon}
            alt=""
            className="h-4 w-4 rounded"
            onError={undefined}
          />
        ) : (
          <TreePine className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <a
          href={`/trails/${trail.id}`}
          className="text-sm font-medium truncate hover:underline underline-offset-2"
        >
          {trail.label ?? "Untitled trail"}
        </a>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {trail.node_count != null && (
            <span>
              {trail.node_count} {trail.node_count === 1 ? "node" : "nodes"}
            </span>
          )}
          {trail.root_url && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="truncate max-w-[200px]">
                {new URL(trail.root_url).hostname.replace(/^www\./, "")}
              </span>
            </>
          )}
          {isArchived && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <Badge variant="outline" className="text-xs h-4 px-1 py-0">
                archived
              </Badge>
            </>
          )}
        </div>
      </div>
      <time
        dateTime={trail.updated_at}
        className="text-xs text-muted-foreground shrink-0 mt-0.5"
      >
        {formatTime(trail.updated_at)}
      </time>
    </div>
  );
}

export default async function ActivityPage() {
  const session = await getAuthSession();
  if (!session) return null;

  const { data } = await db
    .from("trails")
    .select(
      "id, label, node_count, root_url, root_favicon, updated_at, deleted_at",
    )
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  const trails: TrailRow[] = data ?? [];
  const groups = groupByDate(trails);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="text-sm text-muted-foreground">
            Your recent trail activity.
          </p>
        </div>
        {trails.length > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {trails.length}
          </Badge>
        )}
      </div>

      {trails.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <TreePine className="h-12 w-12 text-muted-foreground/40" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">No activity yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your trail activity will appear here once you start browsing with
              the extension.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(({ date, items }) => (
            <div key={date} className="flex flex-col gap-1">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {formatDateHeading(date + "T12:00:00")}
              </h2>
              <div className="flex flex-col divide-y divide-border pl-4 border-l border-border ml-2">
                {items.map((trail) => (
                  <TrailItem key={trail.id} trail={trail} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
