import { useReactFlow } from "@xyflow/react";
import { Button } from "@ui/components/ui/button";
import { ButtonGroup } from "@ui/components/ui/button-group";
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
      <ButtonGroup>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Zoom in"
          onClick={() => zoomIn({ duration: 200 })}
        >
          +
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Zoom out"
          onClick={() => zoomOut({ duration: 200 })}
        >
          −
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Fit view"
          onClick={() => fitView({ padding: 0.2, duration: 300 })}
        >
          ⊞
        </Button>
      </ButtonGroup>
      <ToggleGroup
        type="single"
        size="sm"
        value={layoutMode}
        onValueChange={(v) => {
          if (v) onLayoutModeChange(v as LayoutMode);
        }}
        variant="outline"
      >
        <ToggleGroupItem value="tree">Tree</ToggleGroupItem>
        <ToggleGroupItem value="mindmap">Map</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
