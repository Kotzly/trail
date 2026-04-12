import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { TrailNodeData } from "../types.js";
import { cn } from "@ui/lib/utils";

type TrailNodeProps = {
  data: TrailNodeData;
  selected?: boolean;
};

function TrailNodeComponent({ data, selected }: TrailNodeProps) {
  const {
    title,
    url,
    favicon,
    isCurrent,
    isOpen,
    pinned,
    tabCount,
    isCollapsed,
    childCount,
  } = data;

  const displayUrl = String(url)
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/$/, "");

  const displayTitle = String(title) || displayUrl;

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, width: 6, height: 6 }}
      />
      <div
        className={cn(
          "flex items-center gap-2 px-2.5 py-2 rounded-md border",
          "w-[160px] cursor-grab active:cursor-grabbing select-none",
          isOpen || isCurrent
            ? "bg-card text-card-foreground"
            : "bg-muted/60 text-muted-foreground border-border/50",
          isCurrent && "border-primary shadow-sm shadow-primary/25",
          selected && "ring-2 ring-ring",
        )}
      >
        {favicon && (
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
          <span className="text-[11px] font-medium leading-tight line-clamp-2">
            {displayTitle}
          </span>
          <span className="text-[9px] text-muted-foreground truncate leading-tight">
            {displayUrl}
          </span>
        </div>
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
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, width: 6, height: 6 }}
      />
    </>
  );
}

export const TrailNode = memo(TrailNodeComponent);
