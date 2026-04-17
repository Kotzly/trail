import { memo, useState } from "react";
import { Globe, Layers, RotateCcw } from "lucide-react";
import { Handle, Position, useStore } from "@xyflow/react";
import type { TrailNodeData } from "../types.js";
import { cn } from "@ui/lib/utils";
import { Badge } from "@ui/components/ui/badge";
import { ScrollArea, ScrollBar } from "@ui/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { selectShowDetail, selectShowLabels } from "../lod.js";
import { browser } from "@shared/platform/webext.js";
import type { Url } from "@shared/types/ids.js";

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

function formatBurstSpan(span: { startMs: number; endMs: number }): string {
  const durMs = Math.max(0, span.endMs - span.startMs);
  const minutes = Math.round(durMs / 60_000);
  if (minutes < 1) return "under a minute";
  if (minutes === 1) return "1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hr" : `${hours} hr`;
}

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
    isBurst,
    burstItemCount,
    burstFirstFavicon,
    burstSpan,
    burstItems,
    isRevived,
  } = data;

  const showDetail = useStore(selectShowDetail);
  const showLabels = useStore(selectShowLabels);
  const [burstExpanded, setBurstExpanded] = useState(false);

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
            onActivePath && !isCurrent && "bg-primary/15 border-primary/50",
            isCurrent && "bg-primary/30 border-primary",
            selected && "ring-ring ring-2",
          )}
        />
      </>
    );
  }

  // Burst container: stacked-card body + optional ribbon of items.
  // The stacked affordance uses two absolutely-positioned dashed layers
  // so the card retains the same 160×60 footprint as a normal node
  // (graph layout is measurement-free). The ribbon expands below.
  if (isBurst) {
    const displayFavicon = burstFirstFavicon ?? favicon ?? null;
    const itemLabel = burstItemCount === 1 ? "1 page" : `${burstItemCount} pages`;
    const spanLabel = burstSpan ? formatBurstSpan(burstSpan) : "";
    const subtitle = spanLabel ? `${itemLabel} · ${spanLabel}` : itemLabel;

    return (
      <div className="relative">
        {handles.map((id) => (
          <Handle
            key={id}
            id={id}
            type={handleTypeMap[id]!}
            position={handlePositionMap[id]!}
            style={hidden}
          />
        ))}

        {/* Stacked card layers — visible only when detail LOD is on */}
        {showDetail && (
          <>
            <div
              aria-hidden
              className="border-border/30 absolute top-[4px] left-[6px] h-[60px] w-[160px] rounded-md border border-dashed"
            />
            <div
              aria-hidden
              className="border-border/40 absolute top-[2px] left-[3px] h-[60px] w-[160px] rounded-md border border-dashed"
            />
          </>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setBurstExpanded((v) => !v);
          }}
          className={cn(
            "bg-muted/40 flex min-h-[60px] w-[160px] items-center gap-2 rounded-md border px-2.5 py-2",
            "relative cursor-pointer text-left select-none",
            "transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out will-change-transform",
            "hover:scale-[1.015] hover:shadow-md",
            onActivePath && !isCurrent && "border-primary/50 shadow-primary/15 shadow-sm",
            isCurrent && "border-primary shadow-primary/25 shadow-sm",
            selected && "ring-ring ring-2",
          )}
          aria-expanded={burstExpanded}
          aria-label={`Burst of ${itemLabel}${spanLabel ? `, ${spanLabel}` : ""}`}
        >
          {showDetail &&
            (displayFavicon ? (
              <img
                src={String(displayFavicon)}
                alt=""
                className="size-4 shrink-0 rounded-sm"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Globe
                className="text-muted-foreground/60 size-4 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
            ))}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="line-clamp-2 text-[11px] leading-tight font-medium">
              {displayTitle}
            </span>
            {showDetail && (
              <span className="text-muted-foreground truncate text-[9px] leading-tight">
                {subtitle}
              </span>
            )}
          </div>
          <Layers
            className="text-muted-foreground/80 size-3.5 shrink-0"
            strokeWidth={1.75}
            aria-hidden
          />
          {showDetail && isCollapsed && childCount > 0 && (
            <Badge
              variant="secondary"
              className="absolute top-1 right-1 h-4 rounded px-1 text-[9px] leading-none tabular-nums"
            >
              +{childCount}
            </Badge>
          )}
        </button>

        {burstExpanded && burstItems.length > 0 && (
          <div className="bg-popover text-popover-foreground absolute top-[68px] left-0 z-10 w-[288px] rounded-md border p-2 shadow-md">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-2 pb-2">
                {burstItems.map((item) => (
                  <button
                    key={item.nodeId}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      browser.tabs.create({ url: item.url as Url, active: true }).catch(() => {
                        /* swallowed — user will see no tab open */
                      });
                    }}
                    className="hover:bg-accent flex h-10 w-[120px] shrink-0 items-center gap-1.5 rounded-sm border px-1.5 text-left"
                    title={item.title || item.url}
                  >
                    {item.favicon ? (
                      <img
                        src={String(item.favicon)}
                        alt=""
                        className="size-3.5 shrink-0 rounded-sm"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                        }}
                      />
                    ) : (
                      <Globe
                        className="text-muted-foreground/60 size-3.5 shrink-0"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    )}
                    <span className="truncate text-[10px] leading-tight">
                      {item.title || item.url}
                    </span>
                  </button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}
      </div>
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
          "transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out will-change-transform",
          "hover:scale-[1.015] hover:shadow-md",
          isOpen || isCurrent
            ? "bg-card text-card-foreground"
            : "bg-muted/60 text-muted-foreground border-border/50",
          onActivePath &&
            !isCurrent &&
            "bg-card text-card-foreground border-primary/50 shadow-primary/15 shadow-sm",
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
            <Globe
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
                className="text-muted-foreground h-4 rounded border-transparent px-1 text-[9px] leading-none"
              >
                pin
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
        {showDetail && isRevived && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                aria-label="Restored after auto-cleanup"
                className="text-muted-foreground/60 absolute right-1.5 bottom-1"
              >
                <RotateCcw className="size-2.5" strokeWidth={1.75} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[11px]">
              Restored after auto-cleanup.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </>
  );
}

export const TrailNode = memo(TrailNodeComponent, (prev, next) => {
  if (prev.selected !== next.selected) return false;
  const a = prev.data;
  const b = next.data;
  if (a.burstItems.length !== b.burstItems.length) return false;
  for (let i = 0; i < a.burstItems.length; i += 1) {
    const ai = a.burstItems[i]!;
    const bi = b.burstItems[i]!;
    if (
      ai.nodeId !== bi.nodeId ||
      ai.url !== bi.url ||
      ai.title !== bi.title ||
      ai.favicon !== bi.favicon
    ) {
      return false;
    }
  }
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
    a.isBurst === b.isBurst &&
    a.burstItemCount === b.burstItemCount &&
    a.burstFirstFavicon === b.burstFirstFavicon &&
    a.burstSpan?.startMs === b.burstSpan?.startMs &&
    a.burstSpan?.endMs === b.burstSpan?.endMs &&
    a.isRevived === b.isRevived &&
    a.handles.length === b.handles.length &&
    a.handles.every((h, i) => h === b.handles[i])
  );
});
