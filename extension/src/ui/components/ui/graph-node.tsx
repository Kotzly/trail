import * as React from "react"

import { cn } from "@ui/lib/utils"

function GraphNode({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="graph-node"
      className={cn(
        "flex items-center gap-2 px-2.5 py-2 rounded-md border",
        "w-[160px] h-[52px] cursor-default select-none",
        "bg-muted/60 text-muted-foreground border-border/50",
        "data-[open=true]:bg-card data-[open=true]:text-card-foreground data-[open=true]:border-border",
        "data-[current=true]:bg-card data-[current=true]:text-card-foreground data-[current=true]:border-primary data-[current=true]:shadow-sm data-[current=true]:shadow-primary/25",
        "data-[selected=true]:ring-2 data-[selected=true]:ring-ring",
        className,
      )}
      {...props}
    />
  )
}

function GraphNodeIcon({
  className,
  src,
  ...props
}: React.ComponentProps<"img"> & { src: string }) {
  return (
    <img
      data-slot="graph-node-icon"
      src={src}
      alt=""
      loading="lazy"
      onError={(e) => {
        ;(e.target as HTMLImageElement).style.display = "none"
      }}
      className={cn("size-4 shrink-0 rounded-sm", className)}
      {...props}
    />
  )
}

function GraphNodeContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="graph-node-content"
      className={cn("flex flex-col min-w-0 flex-1 gap-0.5", className)}
      {...props}
    />
  )
}

function GraphNodeTitle({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="graph-node-title"
      className={cn(
        "text-[11px] font-medium leading-tight truncate",
        className,
      )}
      {...props}
    />
  )
}

function GraphNodeDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="graph-node-description"
      className={cn(
        "text-[9px] text-muted-foreground leading-tight truncate",
        className,
      )}
      {...props}
    />
  )
}

function GraphNodeBadges({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="graph-node-badges"
      className={cn("flex flex-col items-end gap-0.5 shrink-0", className)}
      {...props}
    />
  )
}

export {
  GraphNode,
  GraphNodeIcon,
  GraphNodeContent,
  GraphNodeTitle,
  GraphNodeDescription,
  GraphNodeBadges,
}
