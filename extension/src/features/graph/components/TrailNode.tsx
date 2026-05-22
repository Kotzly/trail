import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { TrailNode as TrailNodeType } from "../types.js";
import { trailNodeDataEqual } from "../node-equality.js";
import { cn } from "@ui/lib/utils";
import { Icons } from "@ui/components/icons";
import { Badge } from "@ui/components/ui/badge";
import { Card } from "@ui/components/ui/card";
import { Input } from "@ui/components/ui/input";
import { useInlineRename } from "./inline-rename-context.js";

const hidden = { opacity: 0, width: 6, height: 6 } as const;

const handlePositionMap: Record<string, Position> = {
  "target-top": Position.Top,
  "target-bottom": Position.Bottom,
  "target-left": Position.Left,
  "target-right": Position.Right,
  "source-top": Position.Top,
  "source-bottom": Position.Bottom,
  "source-left": Position.Left,
  "source-right": Position.Right,
};

const handleTypeMap: Record<string, "source" | "target"> = {
  "target-top": "target",
  "target-bottom": "target",
  "target-left": "target",
  "target-right": "target",
  "source-top": "source",
  "source-bottom": "source",
  "source-left": "source",
  "source-right": "source",
};

function TrailNodeComponent({ data, selected }: NodeProps<TrailNodeType>) {
  const {
    nodeId,
    title,
    url,
    favicon,
    isCurrent,
    isOpen,
    onActivePath,
    pinned,
    tabCount,
    isCollapsed,
    childCount,
    wasExpandedViaBadge,
    foldedAncestorCount,
    isChainUnfolded,
    isRenaming,
    dragRole,
    handles,
    spotlight,
  } = data;

  // LOD is driven by CSS rules targeting the `data-lod` attribute that
  // `LodController` sets on the graph container (see pane.css). Each
  // TrailNode used to call `useStore(selectLod)` itself — which meant
  // ~1808 xyflow subscriptions all firing per zoom-threshold cross
  // and ~1808 React re-renders to swap between the plain-rect and
  // full-Card variants. Pulling the subscription out keeps the DOM
  // static; CSS toggles visibility for free on the GPU.

  // Handle-change detection is hoisted to TrailGraph — the parent
  // diffs the layout's handles map across renders and issues a single
  // batched `updateNodeInternals([...changedIds])` call when needed.
  // Doing it here per-node fanned out into N independent effects, and
  // for events that touch many nodes at once (layout-mode switch) they
  // all run in the same commit and the rAF-coalescing inside xyflow
  // only partly hid the cost.

  const displayUrl = String(url)
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "");

  const displayTitle = String(title) || displayUrl;

  return (
    <>
      {handles.map((id) => (
        <Handle
          key={id}
          id={id}
          type={handleTypeMap[id]!}
          position={handlePositionMap[id]!}
          style={hidden}
        />
      ))}
      <Card
        size="default"
        data-trail-card
        className={cn(
          "relative flex min-h-[60px] w-[160px] flex-row items-center gap-2 px-2.5 py-2",
          "cursor-default select-none",
          "transition-[transform,box-shadow,background-color] duration-150 ease-out",
          "hover:scale-[1.015] hover:shadow-md",
          "active:scale-[0.985]",
          !(isOpen || isCurrent) && "bg-muted/60 text-muted-foreground",
          onActivePath && !isCurrent && isOpen && "ring-primary/50 shadow-primary/15 shadow-sm",
          isCurrent && "ring-primary shadow-primary/25 shadow-sm",
          selected && "ring-ring ring-2",
          spotlight === "target" && "trail-spotlight-target",
          spotlight === "pulse" && "trail-spotlight-pulse",
          dragRole === "source" && "ring-primary/40 scale-[1.05] opacity-60 shadow-lg ring-2",
          dragRole === "valid-target" && "ring-primary/80 shadow-primary/30 shadow-md ring-2",
          dragRole === "invalid-target" && "ring-destructive/70 opacity-80 ring-2",
        )}
      >
        {/* `data-lod-detail` markers let pane.css hide non-essential
            chrome (favicon, URL, badges) at mid- and far-zoom. The
            title stays at every LOD so nodes are always identifiable
            — no per-node React subscription required. */}
        <span data-lod-detail className="flex size-4 shrink-0 items-center justify-center">
          {favicon ? (
            <img
              src={String(favicon)}
              alt=""
              className="size-4"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <Icons.Globe
              className="text-muted-foreground/60 size-4 shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
          )}
        </span>
        <div data-lod-title className="flex min-w-0 flex-1 flex-col gap-0.5">
          {isRenaming ? (
            <InlineTitleEditor nodeId={nodeId} initialTitle={String(title)} />
          ) : (
            <span
              className="line-clamp-2 cursor-text text-xs leading-tight font-medium"
              data-rename-trigger="true"
            >
              {displayTitle}
            </span>
          )}
          <span data-lod-detail className="text-muted-foreground truncate text-[6px] leading-tight">
            {displayUrl}
          </span>
        </div>
        <div data-lod-detail className="flex shrink-0 flex-col items-end gap-0.5">
          {tabCount > 1 && (
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary h-4 rounded border-transparent px-1 text-[9px] leading-none tabular-nums"
            >
              {tabCount}
            </Badge>
          )}
          {pinned && (
            <Badge
              variant="outline"
              aria-label="Pinned"
              className="text-muted-foreground h-4 rounded border-transparent px-0.5"
            >
              <Icons.Pin className="size-2.5" aria-hidden />
            </Badge>
          )}
          {isCollapsed && childCount > 0 && (
            <Badge
              asChild
              variant="secondary"
              className="hover:bg-accent hover:text-accent-foreground h-4 rounded px-1 text-[9px] leading-none tabular-nums"
            >
              <button
                type="button"
                aria-label={`${childCount} hidden children — click to expand`}
                data-collapse-action="badge-toggle"
              >
                +{childCount}
              </button>
            </Badge>
          )}
          {wasExpandedViaBadge && !isCollapsed && (
            <Badge
              asChild
              variant="secondary"
              className="hover:bg-accent hover:text-accent-foreground h-4 rounded px-1 text-[9px] leading-none"
            >
              <button
                type="button"
                aria-label="Re-collapse children"
                data-collapse-action="badge-toggle"
              >
                ↓
              </button>
            </Badge>
          )}
          {foldedAncestorCount > 0 && (
            <Badge
              asChild
              variant="outline"
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-4 rounded border-dashed px-1 text-[9px] leading-none tabular-nums"
            >
              <button
                type="button"
                aria-label={`${foldedAncestorCount} hidden steps — click to unfold`}
                data-fold-action="toggle"
              >
                ⋯{foldedAncestorCount}
              </button>
            </Badge>
          )}
          {isChainUnfolded && (
            <Badge
              asChild
              variant="outline"
              className="text-primary/70 hover:bg-accent h-4 rounded border-dashed px-1 text-[9px] leading-none tabular-nums"
            >
              <button
                type="button"
                aria-label="Chain unfolded — click to refold"
                data-fold-action="toggle"
              >
                ⇡
              </button>
            </Badge>
          )}
        </div>
      </Card>
    </>
  );
}

export const TrailNode = memo(TrailNodeComponent, (prev, next) => {
  if (prev.selected !== next.selected) return false;
  return trailNodeDataEqual(prev.data, next.data);
});

/**
 * Inline title editor — replaces the static `<span>` while
 * `data.isRenaming` is true. Enter commits, Escape cancels, blur acts
 * like Enter (so clicking elsewhere saves rather than silently
 * discards). Rendered inside the same flex slot so the node geometry
 * stays put — no layout reflow on edit start/end.
 */
function InlineTitleEditor({
  nodeId,
  initialTitle,
}: {
  nodeId: import("@shared/types/ids.js").NodeId;
  initialTitle: string;
}) {
  const { onCommit, onCancel } = useInlineRename();
  const [value, setValue] = useState(initialTitle);
  const committedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed === initialTitle) {
      onCancel();
      return;
    }
    onCommit(nodeId, trimmed);
  };

  const cancel = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  };

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cancel();
        } else {
          // Stop propagation so global hotkeys (Delete, F2, P, arrows…)
          // don't fire while the user types into the rename field.
          e.stopPropagation();
        }
      }}
      onBlur={commit}
      onClick={(e) => {
        // Prevent the parent node click handler from triggering navigation
        // when the user clicks inside the input to position the caret.
        e.stopPropagation();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      maxLength={500}
      className={cn(
        "h-auto min-w-0 border-none bg-transparent px-0.5 py-0",
        "text-xs leading-tight font-medium",
      )}
      aria-label="Rename node"
    />
  );
}
