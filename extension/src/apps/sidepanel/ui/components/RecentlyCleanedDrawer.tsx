import { useCallback, useEffect, useState } from "react";
import type { CleanupTombstoneEntry } from "@shared/rpc/contracts.js";
import { browser } from "@shared/platform/webext.js";
import { Button } from "@ui/components/ui/button";
import { ScrollArea } from "@ui/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@ui/components/ui/sheet";
import { Badge } from "@ui/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@ui/components/ui/empty";
import { listTombstones, restoreTombstone } from "../../api/cleanup.js";
import { useStore } from "../state/store.js";
import { Icons } from "./Icon.js";
import { showOperationError } from "../shared/show-operation-error.js";

type Group = { label: string; entries: CleanupTombstoneEntry[] };

const REASON_LABEL: Record<CleanupTombstoneEntry["reason"], string> = {
  glance: "glance",
  burst: "burst",
  "round-trip": "round-trip",
};

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function groupEntries(entries: CleanupTombstoneEntry[]): Group[] {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  const sorted = [...entries].sort((a, b) => b.removedAt - a.removedAt);
  const buckets = new Map<string, CleanupTombstoneEntry[]>();
  const order: string[] = [];
  const pushTo = (label: string, entry: CleanupTombstoneEntry) => {
    if (!buckets.has(label)) {
      buckets.set(label, []);
      order.push(label);
    }
    buckets.get(label)!.push(entry);
  };

  for (const entry of sorted) {
    if (entry.removedAt >= todayStart) {
      pushTo("TODAY", entry);
    } else if (entry.removedAt >= yesterdayStart) {
      pushTo("YESTERDAY", entry);
    } else {
      const label = new Date(entry.removedAt).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
      pushTo(label, entry);
    }
  }

  return order.map((label) => ({ label, entries: buckets.get(label)! }));
}

type RowProps = {
  entry: CleanupTombstoneEntry;
  onRestore: (entry: CleanupTombstoneEntry) => void;
  onOpen: (entry: CleanupTombstoneEntry) => void;
};

function Row({ entry, onRestore, onOpen }: RowProps) {
  const displayUrl = entry.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="hover:bg-accent focus-visible:ring-ring -mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {entry.favicon ? (
        <img
          src={entry.favicon}
          alt=""
          width={16}
          height={16}
          className="size-4 shrink-0 rounded-sm"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      ) : (
        <Icons.Globe className="text-muted-foreground/60 size-4 shrink-0" strokeWidth={1.75} />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] leading-tight font-medium">
          {entry.title || displayUrl}
        </span>
        <span className="text-muted-foreground truncate text-[11px] leading-tight">
          {displayUrl}
        </span>
      </div>
      <Badge
        variant="outline"
        className="text-muted-foreground h-5 shrink-0 rounded px-1.5 text-[10px] leading-none"
      >
        {REASON_LABEL[entry.reason]}
      </Badge>
      <span className="text-muted-foreground w-10 shrink-0 text-right text-[11px] tabular-nums">
        {formatTime(entry.removedAt)}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Restore"
        onClick={(e) => {
          e.stopPropagation();
          onRestore(entry);
        }}
      >
        <Icons.RotateCcw />
      </Button>
    </button>
  );
}

export default function RecentlyCleanedDrawer() {
  const open = useStore((s) => s.recentlyCleanedOpen);
  const setOpen = useStore((s) => s.setRecentlyCleanedOpen);
  const [entries, setEntries] = useState<CleanupTombstoneEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listTombstones();
      setEntries(list);
    } catch (error) {
      showOperationError("Load recently cleaned", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  const handleRestore = useCallback(
    async (entry: CleanupTombstoneEntry) => {
      try {
        await restoreTombstone(entry.nodeId);
        await refresh();
      } catch (error) {
        showOperationError("Restore page", error);
      }
    },
    [refresh],
  );

  const handleOpen = useCallback((entry: CleanupTombstoneEntry) => {
    browser.tabs.create({ url: entry.url, active: true }).catch((error) => {
      console.error("Failed to open tombstoned URL:", error);
    });
  }, []);

  const groups = groupEntries(entries);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-md"
        aria-describedby="recently-cleaned-desc"
      >
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <Icons.History className="size-4" />
            Recently cleaned
          </SheetTitle>
          <SheetDescription id="recently-cleaned-desc">
            Pages Trail auto-removed in the last 72 hours. Click to reopen, or restore into the
            tree.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-4 px-4 py-3">
            {loading && entries.length === 0 ? (
              <div className="text-muted-foreground py-6 text-center text-sm">Loading…</div>
            ) : entries.length === 0 ? (
              <Empty className="border-none py-6">
                <EmptyHeader>
                  <EmptyMedia>
                    <Icons.History className="text-muted-foreground size-6" />
                  </EmptyMedia>
                  <EmptyTitle>No recent cleanups</EmptyTitle>
                  <EmptyDescription>
                    Trail hasn't cleaned anything in the last 72 hours.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              groups.map((group) => (
                <section key={group.label} className="flex flex-col gap-1">
                  <h3 className="text-muted-foreground px-2 text-[10px] tracking-wider uppercase">
                    {group.label}
                  </h3>
                  <div className="flex flex-col">
                    {group.entries.map((entry) => (
                      <Row
                        key={entry.nodeId}
                        entry={entry}
                        onRestore={handleRestore}
                        onOpen={handleOpen}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
