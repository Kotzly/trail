"use client";

import { useState, useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  GitBranch,
  MoreHorizontal,
  Archive,
  RotateCcw,
  Pencil,
  ExternalLink,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { TrailSummary } from "@/src/server/trails";
import {
  renameTrail,
  archiveTrail,
  restoreTrail,
  loadMoreTrails,
} from "./mutations";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en", { month: "short", day: "numeric", year: diffDay > 365 ? "numeric" : undefined });
}

type RenameDialogProps = {
  open: boolean;
  trail: TrailSummary;
  onClose: () => void;
};

function RenameDialog({ open, trail, onClose }: RenameDialogProps) {
  const [state, formAction, isPending] = useActionState(renameTrail, {});
  const [label, setLabel] = useState(trail.label);

  const handleAction = async (formData: FormData) => {
    formData.set("trailId", trail.id);
    await formAction(formData);
    if (!state.error) {
      toast.success("Trail renamed");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename trail</DialogTitle>
        </DialogHeader>
        <form action={handleAction} className="flex flex-col gap-4">
          <input type="hidden" name="trailId" value={trail.id} />
          <Input
            name="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Trail name"
            autoFocus
          />
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !label.trim()}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type TrailCardProps = {
  trail: TrailSummary;
  showArchived: boolean;
};

function TrailCard({ trail, showArchived }: TrailCardProps) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isArchived = trail.deletedAt !== null && trail.deletedAt !== undefined;

  const handleArchive = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("trailId", trail.id);
      const result = await archiveTrail({}, fd);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Trail archived");
      }
    });
  };

  const handleRestore = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("trailId", trail.id);
      const result = await restoreTrail({}, fd);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Trail restored");
      }
    });
  };

  return (
    <>
      <Card
        className={cn(
          "group cursor-pointer transition-colors hover:bg-accent/50",
          isPending && "opacity-60 pointer-events-none",
          isArchived && "opacity-75",
        )}
        onClick={() => router.push(`/trails/${trail.id}`)}
      >
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {trail.rootFavicon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trail.rootFavicon}
                alt=""
                className="h-5 w-5 rounded shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <GitBranch className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <CardTitle className="text-sm font-medium leading-tight truncate">
              {trail.label}
            </CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Trail actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              {trail.rootUrl && (
                <DropdownMenuItem asChild>
                  <a href={trail.rootUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open root URL
                  </a>
                </DropdownMenuItem>
              )}
              <Separator className="my-1" />
              {isArchived ? (
                <DropdownMenuItem onSelect={handleRestore}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onSelect={handleArchive}
                  className="text-destructive focus:text-destructive"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="pt-0">
          <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span>{trail.nodeCount} {trail.nodeCount === 1 ? "node" : "nodes"}</span>
            <span className="text-muted-foreground/50">·</span>
            <span>{formatRelativeTime(trail.updatedAt)}</span>
            {isArchived && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <Badge variant="outline" className="text-xs h-4 px-1 py-0">archived</Badge>
              </>
            )}
          </CardDescription>
        </CardContent>
      </Card>
      <RenameDialog
        open={renameOpen}
        trail={trail}
        onClose={() => setRenameOpen(false)}
      />
    </>
  );
}

type TrailsListProps = {
  initialTrails: TrailSummary[];
  totalCount: number;
  initialNextCursor: string | null;
};

export function TrailsList({ initialTrails, totalCount, initialNextCursor }: TrailsListProps) {
  const [trails, setTrails] = useState<TrailSummary[]>(initialTrails);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [showArchived, setShowArchived] = useState(false);
  const [isLoadingMore, startLoadMore] = useTransition();

  const visibleTrails = showArchived
    ? trails
    : trails.filter((t) => !t.deletedAt);

  const handleLoadMore = () => {
    if (!nextCursor) return;
    startLoadMore(async () => {
      const result = await loadMoreTrails(nextCursor, showArchived);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const { items, nextCursor: newCursor } = result.data as {
        items: TrailSummary[];
        nextCursor: string | null;
      };
      setTrails((prev) => [...prev, ...items]);
      setNextCursor(newCursor);
    });
  };

  if (trails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <GitBranch className="h-12 w-12 text-muted-foreground/50" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">No trails yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Install the Trail browser extension to start capturing your browsing journeys.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a
            href="https://chromewebstore.google.com/detail/trail/pginmdonnghdkcmnhjkniphopcfapodc"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download className="h-4 w-4 mr-2" />
            Get the extension
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {visibleTrails.length} of {totalCount} trails
        </p>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            className="sr-only"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          <div
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors",
              showArchived ? "bg-primary" : "bg-input",
            )}
            role="switch"
            aria-checked={showArchived}
            onClick={() => setShowArchived((v) => !v)}
          >
            <div
              className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                showArchived && "translate-x-4",
              )}
            />
          </div>
          <span>Show archived</span>
        </label>
      </div>

      {visibleTrails.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No active trails. Toggle &ldquo;Show archived&rdquo; to see archived ones.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleTrails.map((trail) => (
            <TrailCard key={trail.id} trail={trail} showArchived={showArchived} />
          ))}
        </div>
      )}

      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
