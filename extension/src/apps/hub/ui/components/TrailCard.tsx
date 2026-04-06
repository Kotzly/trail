import type { LocalTrailSummary } from "../hooks/useLocalTrails.js";
import { Badge } from "@ui/components/ui/badge";
import { Card } from "@ui/components/ui/card";

type TrailCardProps = {
  trail: LocalTrailSummary;
};

function formatRelative(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 0) {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export default function TrailCard({ trail }: TrailCardProps) {
  return (
    <a href={`#/trails/${trail.id}`} className="block no-underline text-inherit">
      <Card className="gap-2.5 p-3.5 rounded-lg shadow-none transition-colors hover:bg-muted/50">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {trail.rootFavicon ? (
              <img
                src={trail.rootFavicon}
                alt=""
                width={16}
                height={16}
                className="size-4 shrink-0 rounded-sm"
              />
            ) : (
              <span className="size-4 shrink-0 rounded-sm bg-muted flex items-center justify-center" />
            )}
            <span className="text-[13px] font-medium text-foreground truncate">{trail.label}</span>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[11px] tabular-nums">
            {trail.nodeCount} node{trail.nodeCount === 1 ? "" : "s"}
          </Badge>
        </div>

        {trail.rootTitle && <p className="text-xs text-muted-foreground truncate m-0">{trail.rootTitle}</p>}

        <div className="text-[11px] text-muted-foreground">
          <time>{formatRelative(trail.savedAt)}</time>
        </div>
      </Card>
    </a>
  );
}
