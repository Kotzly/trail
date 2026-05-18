import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, useStore, useUpdateNodeInternals } from "@xyflow/react";
import type { TrailNodeData } from "../types.js";
import { cn } from "@ui/lib/utils";
import { Icons } from "@ui/components/icons";
import { Badge } from "@ui/components/ui/badge";
import { Card } from "@ui/components/ui/card";
import { Input } from "@ui/components/ui/input";
import { selectLod, showDetailAt, showLabelsAt } from "../lod.js";
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

/**
 * Cache of the handlesKey we last passed to `updateNodeInternals(id)`
 * per node id, lifetime of the page. Skipping the xyflow call when
 * handles haven't actually changed avoids the global store set({})
 * cascade — that wakes every useStore subscriber and is the dominant
 * cost behind remount-driven pan jank. First sighting of an id always
 * falls through (cache miss), preserving the original bug fix where
 * a node with brand-new handles needs an internals refresh so incident
 * edges can be drawn.
 */
const lastHandlesKeyById = new Map<string, string>();

function TrailNodeComponent({
  id,
  data,
  selected,
}: {
  id: string;
  data: TrailNodeData;
  selected?: boolean;
}) {
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

  // One xyflow subscription per node instead of two independent boolean
  // selectors. Tri-state `selectLod` only flips twice per zoom gesture,
  // so the overhead during panning/tweening is a single string-compare
  // per node per frame.
  const lod = useStore(selectLod);
  const showLabels = showLabelsAt(lod);
  const showDetail = showDetailAt(lod);

  // When handles change (e.g. first child added → parent gains
  // `source-bottom`, or freshly mounted node registers `target-top`),
  // React Flow must re-measure them so incident edges can be drawn.
  // Without this, a new parent→child edge stays invisible until the
  // viewport re-culls it (pan/zoom), which was the reported bug.
  //
  // The module-level cache above skips the call when the handles
  // string is identical to the last one we passed for this id —
  // remounts (collapse/expand, lifecycle return) no longer trigger
  // the global store set({}) cascade.
  const handlesKey = handles.join("|");
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    if (lastHandlesKeyById.get(id) === handlesKey) return;
    lastHandlesKeyById.set(id, handlesKey);
    updateNodeInternals(id);
  }, [id, handlesKey, updateNodeInternals]);

  const displayUrl = String(url)
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "");

  const displayTitle = String(title) || displayUrl;

  // LOD: minimal colored rectangle when zoomed way out
  if (!showLabels) {
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
        <div
          className={cn(
            "h-[60px] w-[160px] border",
            isOpen || isCurrent
              ? "bg-foreground/20 border-foreground/30"
              : "bg-foreground/10 border-foreground/15",
            onActivePath && !isCurrent && isOpen && "bg-primary/15 border-primary/50",
            isCurrent && "bg-primary/30 border-primary",
            selected && "ring-ring ring-2",
          )}
        />
      </>
    );
  }

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
        {showDetail &&
          (favicon ? (
            <span className="flex size-4 shrink-0 items-center justify-center">
              <img
                src={String(favicon)}
                alt=""
                className="size-4"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </span>
          ) : (
            <Icons.Globe
              className="text-muted-foreground/60 size-4 shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
          ))}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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
          {showDetail && (
            <span className="text-muted-foreground truncate text-[6px] leading-tight">
              {displayUrl}
            </span>
          )}
        </div>
        {showDetail && (
          <div className="flex shrink-0 flex-col items-end gap-0.5">
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
        )}
      </Card>
    </>
  );
}

export const TrailNode = memo(TrailNodeComponent, (prev, next) => {
  if (prev.selected !== next.selected) return false;
  const a = prev.data;
  const b = next.data;
  return (
    a.title === b.title &&
    a.url === b.url &&
    a.favicon === b.favicon &&
    a.isCurrent === b.isCurrent &&
    a.isOpen === b.isOpen &&
    a.onActivePath === b.onActivePath &&
    a.pinned === b.pinned &&
    a.tabCount === b.tabCount &&
    a.childCount === b.childCount &&
    a.isCollapsed === b.isCollapsed &&
    a.wasExpandedViaBadge === b.wasExpandedViaBadge &&
    a.foldedAncestorCount === b.foldedAncestorCount &&
    a.isChainUnfolded === b.isChainUnfolded &&
    a.isRenaming === b.isRenaming &&
    a.dragRole === b.dragRole &&
    a.handles.length === b.handles.length &&
    a.handles.every((h, i) => h === b.handles[i]) &&
    a.spotlight === b.spotlight
  );
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
