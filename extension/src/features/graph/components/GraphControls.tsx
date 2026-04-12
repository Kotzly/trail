import { useReactFlow } from "@xyflow/react";
import { Button } from "@ui/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@ui/components/ui/toggle-group";
import type { LayoutMode } from "../types.js";

type GraphControlsProps = {
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
};

export function GraphControls({
  layoutMode,
  onLayoutModeChange,
}: GraphControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1">
      <div className="flex items-center bg-card border rounded-md overflow-hidden shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-none text-xs text-muted-foreground hover:text-foreground"
          onClick={() => zoomIn({ duration: 200 })}
        >
          +
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-none text-xs text-muted-foreground hover:text-foreground"
          onClick={() => zoomOut({ duration: 200 })}
        >
          −
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-none text-xs text-muted-foreground hover:text-foreground"
          onClick={() => fitView({ padding: 0.2, duration: 300 })}
        >
          ⊞
        </Button>
      </div>
      <ToggleGroup
        type="single"
        value={layoutMode}
        onValueChange={(v) => {
          if (v) onLayoutModeChange(v as LayoutMode);
        }}
        className="bg-card border rounded-md overflow-hidden shadow-sm gap-0"
      >
        <ToggleGroupItem
          value="tree"
          className="h-7 px-2 text-[11px] rounded-none data-[state=on]:bg-accent"
        >
          Tree
        </ToggleGroupItem>
        <ToggleGroupItem
          value="mindmap"
          className="h-7 px-2 text-[11px] rounded-none data-[state=on]:bg-accent"
        >
          Map
        </ToggleGroupItem>
        <ToggleGroupItem
          value="radial"
          className="h-7 px-2 text-[11px] rounded-none data-[state=on]:bg-accent"
        >
          Radial
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
