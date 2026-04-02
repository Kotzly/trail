"use client";

import { useState, useActionState, useTransition } from "react";
import { toast } from "sonner";
import {
  GitBranch,
  Pencil,
  Archive,
  Download,
  ChevronRight,
  ExternalLink,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { TrailDetail } from "@/src/server/trails";
import { renameTrailById, archiveTrailById, exportTrail } from "./mutations";

// ─── Types ───────────────────────────────────────────────────────────────────

type TreeNode = {
  data?: {
    url?: string;
    title?: string;
    favicon?: string;
    [key: string]: unknown;
  };
  children?: TreeNode[];
};

type TrailPayload = {
  root?: TreeNode;
  nodeCount?: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(dateStr);
}

// ─── Rename Dialog ────────────────────────────────────────────────────────────

function RenameDialog({
  open,
  trail,
  onClose,
}: {
  open: boolean;
  trail: TrailDetail;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(renameTrailById, {});
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

// ─── Archive Dialog ───────────────────────────────────────────────────────────

function ArchiveDialog({
  open,
  trail,
  onClose,
}: {
  open: boolean;
  trail: TrailDetail;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(archiveTrailById, {});

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Archive trail?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          &ldquo;{trail.label}&rdquo; will be archived and hidden from your main list. You can restore it anytime.
        </p>
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <form action={formAction} className="contents">
          <input type="hidden" name="trailId" value={trail.id} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Node Inspector Panel ─────────────────────────────────────────────────────

function NodeInspector({
  node,
  onClose,
}: {
  node: TreeNode | null;
  onClose: () => void;
}) {
  if (!node) return null;

  const { data } = node;
  const childCount = node.children?.length ?? 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-tight">{data?.title ?? "Untitled"}</p>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="h-3 w-3" />
          <span className="sr-only">Close</span>
        </Button>
      </div>
      {data?.url && (
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary hover:underline break-all"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          {data.url}
        </a>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{childCount} {childCount === 1 ? "child" : "children"}</span>
      </div>
    </div>
  );
}

// ─── Tree Node Row ────────────────────────────────────────────────────────────

function TreeNodeRow({
  node,
  depth,
  onSelect,
  selectedNode,
}: {
  node: TreeNode;
  depth: number;
  onSelect: (node: TreeNode) => void;
  selectedNode: TreeNode | null;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isSelected = selectedNode === node;
  const { data } = node;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1.5 rounded px-2 py-1 text-sm cursor-pointer hover:bg-accent/50 transition-colors",
          isSelected && "bg-accent",
        )}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <button
            type="button"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {data?.favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.favicon}
            alt=""
            className="h-4 w-4 rounded shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        )}

        <span className="truncate flex-1 leading-tight">
          {data?.title ?? data?.url ?? "Untitled"}
        </span>

        {data?.url && (
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children!.map((child, i) => (
            <TreeNodeRow
              key={i}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedNode={selectedNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TrailDetail({ trail }: { trail: TrailDetail }) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [isExporting, startExport] = useTransition();

  const payload = trail.payload as TrailPayload | null;
  const rootNode = payload?.root ?? null;

  const handleExport = () => {
    startExport(async () => {
      const result = await exportTrail(trail.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trail-${trail.id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported successfully");
    });
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight truncate">
              {trail.label}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{trail.nodeCount} {trail.nodeCount === 1 ? "node" : "nodes"}</span>
              {trail.rootUrl && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <a
                    href={trail.rootUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground transition-colors truncate max-w-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{trail.rootTitle ?? trail.rootUrl}</span>
                  </a>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
              <span>Created {formatRelativeTime(trail.createdAt)}</span>
              <span className="text-muted-foreground/40">·</span>
              <span>Updated {formatRelativeTime(trail.updatedAt)}</span>
              {trail.labelSource === "user" && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <Badge variant="outline" className="text-xs h-4 px-1 py-0">renamed</Badge>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setRenameOpen(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Rename
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-1.5" />
              {isExporting ? "Exporting…" : "Export"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setArchiveOpen(true)}
            >
              <Archive className="h-4 w-4 mr-1.5" />
              Archive
            </Button>
          </div>
        </div>

        <Separator />
      </div>

      {/* Tree + Inspector */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Tree
          </h2>
          {rootNode ? (
            <ScrollArea className="max-h-[60vh] rounded-lg border bg-card">
              <div className="py-2">
                <TreeNodeRow
                  node={rootNode}
                  depth={0}
                  onSelect={setSelectedNode}
                  selectedNode={selectedNode}
                />
              </div>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center rounded-lg border bg-card py-12 text-sm text-muted-foreground">
              No tree data available
            </div>
          )}
        </div>

        {selectedNode && (
          <div className="lg:w-80 shrink-0">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">
              Node details
            </h2>
            <NodeInspector
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </div>

      <RenameDialog
        open={renameOpen}
        trail={trail}
        onClose={() => setRenameOpen(false)}
      />
      <ArchiveDialog
        open={archiveOpen}
        trail={trail}
        onClose={() => setArchiveOpen(false)}
      />
    </>
  );
}
