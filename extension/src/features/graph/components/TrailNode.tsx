import { memo } from "react";
import { Handle, Position, useStore } from "@xyflow/react";
import type { TrailNodeData } from "../types.js";
import { cn } from "@ui/lib/utils";
import { selectShowDetail, selectShowLabels } from "../lod.js";

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


function TrailNodeComponent({ data, selected }: { data: TrailNodeData; selected?: boolean }) {
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

  const showDetail = useStore(selectShowDetail);
  const showLabels = useStore(selectShowLabels);

  const displayUrl = String(url)
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "");

  const displayTitle = String(title) || displayUrl;


  // LOD: minimal colored rectangle when zoomed way out
  if (!showLabels) {
    return (
      <>
        {handles.map((id) => (
          <Handle key={id} id={id} type={handleTypeMap[id]!} position={handlePositionMap[id]!} style={hidden} />
        ))}
        <div
          className={cn(
            "w-[160px] h-[52px] rounded-sm border-2",
            isOpen || isCurrent
              ? "bg-foreground/20 border-foreground/30"
              : "bg-foreground/10 border-foreground/15",
            onActivePath && !isCurrent && "bg-primary/15 border-primary/50",
            isCurrent && "bg-primary/30 border-primary",
            selected && "ring-2 ring-ring",
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
          "flex items-center gap-2 px-2.5 py-2 rounded-md border",
          "w-[160px] cursor-default select-none",
          isOpen || isCurrent
            ? "bg-card text-card-foreground"
            : "bg-muted/60 text-muted-foreground border-border/50",
          onActivePath && !isCurrent && "bg-card text-card-foreground border-primary/50 shadow-sm shadow-primary/15",
          isCurrent && "border-primary shadow-sm shadow-primary/25",
          selected && "ring-2 ring-ring",
        )}
      >
        {showDetail && favicon && (
          <img
            src={String(favicon)}
            alt=""
            className="size-4 shrink-0 rounded-sm"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
          <span className="text-[11px] font-medium leading-tight line-clamp-2 min-h-[2lh]">
            {displayTitle}
          </span>
          {showDetail && (
            <span className="text-[9px] text-muted-foreground truncate leading-tight">
              {displayUrl}
            </span>
          )}
        </div>
        {showDetail && (
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            {tabCount > 1 && (
              <span className="text-[9px] bg-primary/10 text-primary rounded px-1 py-0.5 tabular-nums font-medium leading-none">
                {tabCount}
              </span>
            )}
            {pinned && (
              <span className="text-[9px] text-muted-foreground leading-none">pin</span>
            )}
            {isCollapsed && childCount > 0 && (
              <span className="text-[9px] bg-muted text-muted-foreground rounded px-1 py-0.5 tabular-nums font-medium leading-none">
                +{childCount}
              </span>
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
