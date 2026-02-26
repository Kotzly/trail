"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, Clock, SortAsc, Hash } from "lucide-react";
import type { TrailSummary } from "@/src/server/trails";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortOption = "newest" | "oldest" | "name" | "nodes";

const sortOptions: { value: SortOption; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "newest", label: "Newest first", icon: Clock },
  { value: "oldest", label: "Oldest first", icon: Clock },
  { value: "name", label: "Name A-Z", icon: SortAsc },
  { value: "nodes", label: "Most nodes", icon: Hash },
];

function sortTrails(trails: TrailSummary[], sort: SortOption): TrailSummary[] {
  return [...trails].sort((a, b) => {
    switch (sort) {
      case "newest":
        return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
      case "oldest":
        return new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime();
      case "name":
        return (a.label ?? "").localeCompare(b.label ?? "");
      case "nodes":
        return b.nodeCount - a.nodeCount;
    }
  });
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 0) {
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

export function TrailsClient({ trails }: { trails: TrailSummary[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = q
      ? trails.filter(
          (t) =>
            t.label.toLowerCase().includes(q) ||
            t.rootTitle?.toLowerCase().includes(q) ||
            t.rootUrl?.toLowerCase().includes(q),
        )
      : trails;
    return sortTrails(base, sort);
  }, [trails, search, sort]);

  if (trails.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* Search and sort bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search trails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
          <SelectTrigger className="h-9 w-[160px]">
            <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((trail) => (
            <TrailCard key={trail.id} trail={trail} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium">No matching trails</p>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search query.
          </p>
        </div>
      )}
    </div>
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
        {trail.updatedAt !== trail.savedAt && (
          <span>updated {formatRelative(trail.updatedAt)}</span>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">No trails yet</p>
        <p className="max-w-[300px] text-sm text-muted-foreground">
          Start browsing with the Trail extension and your trails will appear
          here automatically.
        </p>
      </div>
    </div>
  );
}
