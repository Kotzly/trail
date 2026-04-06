import { Icons } from "@apps/sidepanel/ui/components/Icon.js";
import { cn } from "../../../../ui/lib/utils.js";
import { Button } from "@ui/components/ui/button";
import { Separator } from "@ui/components/ui/separator";

type GraphZoomControlsProps = {
  tool: "hand" | "select";
  onToolChange: (tool: "hand" | "select") => void;
  onZoom: (direction: "in" | "out" | "reset") => void;
  onOpenFullView: () => void;
  fullViewEnabled: boolean;
};

export default function GraphZoomControls({
  tool,
  onToolChange,
  onZoom,
  onOpenFullView,
  fullViewEnabled,
}: GraphZoomControlsProps) {
  return (
    <div
      className="absolute bottom-3 right-3 flex flex-col gap-0.5 bg-background/90 backdrop-blur-sm border border-border rounded-lg shadow-sm p-0.5 z-10"
      data-graph-ui="true"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn("rounded-md", tool === "select" && "bg-accent")}
        data-tool="select"
        aria-label="Select tool (V) - Select nodes"
        data-tooltip="Select tool (V)"
        type="button"
        onClick={() => onToolChange("select")}
      >
        <Icons.MousePointer2 />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn("rounded-md", tool === "hand" && "bg-accent")}
        data-tool="hand"
        aria-label="Hand tool (H) - Pan"
        data-tooltip="Hand tool (H)"
        type="button"
        onClick={() => onToolChange("hand")}
      >
        <Icons.Hand />
      </Button>
      <Separator className="mx-1 my-0.5" />
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-md"
        data-zoom="in"
        aria-label="Zoom in (+)"
        data-tooltip="Zoom in (+)"
        type="button"
        onClick={() => onZoom("in")}
      >
        <Icons.ZoomIn />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-md"
        data-zoom="out"
        aria-label="Zoom out (-)"
        data-tooltip="Zoom out (-)"
        type="button"
        onClick={() => onZoom("out")}
      >
        <Icons.ZoomOut />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-md"
        data-zoom="reset"
        aria-label="Reset zoom (0)"
        data-tooltip="Reset zoom (0)"
        type="button"
        onClick={() => onZoom("reset")}
      >
        <Icons.Maximize />
      </Button>
      {fullViewEnabled && (
        <>
          <Separator className="mx-1 my-0.5" />
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-md"
            aria-label="Open full view"
            data-tooltip="Open full view"
            type="button"
            onClick={onOpenFullView}
          >
            <Icons.ExternalLink />
          </Button>
        </>
      )}
    </div>
  );
}
