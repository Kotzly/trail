import { useReactFlow } from "@xyflow/react";
import { Button } from "@ui/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@ui/components/ui/toggle-group";
import type { LayoutMode } from "../types.js";

type GraphControlsProps = {
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
};

export function GraphControls({ layoutMode, onLayoutModeChange }: GraphControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1">
      <div className="bg-card flex items-center overflow-hidden rounded-md border shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-none text-xs"
          onClick={() => zoomIn({ duration: 200 })}
        >
          +
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-none text-xs"
          onClick={() => zoomOut({ duration: 200 })}
        >
          −
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-none text-xs"
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
        className="bg-card gap-0 overflow-hidden rounded-md border shadow-sm"
      >
        <ToggleGroupItem
          value="tree"
          className="data-[state=on]:bg-accent h-7 rounded-none px-2 text-[11px]"
        >
          Tree
        </ToggleGroupItem>
        <ToggleGroupItem
          value="mindmap"
          className="data-[state=on]:bg-accent h-7 rounded-none px-2 text-[11px]"
        >
          Map
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
