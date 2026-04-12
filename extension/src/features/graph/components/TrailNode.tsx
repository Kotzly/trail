import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { TrailNodeData } from "../types.js";
import { cn } from "@ui/lib/utils";

const hidden = { opacity: 0, width: 6, height: 6 } as const;

function TrailNodeComponent({ data, selected }: { data: TrailNodeData; selected?: boolean }) {
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
      <Handle id="target-top" type="target" position={Position.Top} style={hidden} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} style={hidden} />
      <Handle id="target-left" type="target" position={Position.Left} style={hidden} />
      <Handle id="target-right" type="target" position={Position.Right} style={hidden} />
      <Handle id="source-top" type="source" position={Position.Top} style={hidden} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={hidden} />
      <Handle id="source-left" type="source" position={Position.Left} style={hidden} />
      <Handle id="source-right" type="source" position={Position.Right} style={hidden} />
      <div
        className={cn(
          "flex items-center gap-2 px-2.5 py-2 rounded-md border",
          "w-[160px] cursor-default select-none",
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
    </>
  );
}

export const TrailNode = memo(TrailNodeComponent);
