import { memo, useEffect } from "react";
import { Handle, Position, useStore, useUpdateNodeInternals } from "@xyflow/react";
import type { TrailNodeData } from "../types.js";
import { cn } from "@ui/lib/utils";
import { Icons } from "@ui/components/icons";
import { Badge } from "@ui/components/ui/badge";
import { selectLod, showDetailAt, showLabelsAt } from "../lod.js";

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
    handles,
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
  const handlesKey = handles.join("|");
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
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
            "h-[60px] w-[160px] rounded-md border",
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
      <div
        className={cn(
          "relative flex min-h-[60px] items-center gap-2 rounded-md border px-2.5 py-2",
          "w-[160px] cursor-default select-none",
          "transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out",
          "hover:scale-[1.015] hover:shadow-md",
          isOpen || isCurrent
            ? "bg-card text-card-foreground"
            : "bg-muted/60 text-muted-foreground border-border/50",
          onActivePath && !isCurrent && isOpen && "border-primary/50 shadow-primary/15 shadow-sm",
          isCurrent && "border-primary shadow-primary/25 shadow-sm",
          selected && "ring-ring ring-2",
        )}
      >
        {showDetail &&
          (favicon ? (
            <img
              src={String(favicon)}
              alt=""
              className="size-4 shrink-0 rounded-sm"
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
          ))}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 text-[11px] leading-tight font-medium">{displayTitle}</span>
          {showDetail && (
            <span className="text-muted-foreground truncate text-[9px] leading-tight">
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
                variant="secondary"
                className="h-4 rounded px-1 text-[9px] leading-none tabular-nums"
              >
                +{childCount}
              </Badge>
            )}
          </div>
        )}
      </div>
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
    a.handles.length === b.handles.length &&
    a.handles.every((h, i) => h === b.handles[i])
  );
});
