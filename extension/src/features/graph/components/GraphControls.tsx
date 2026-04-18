import { useReactFlow } from "@xyflow/react";
import { Icons } from "@ui/components/icons";
import { Button } from "@ui/components/ui/button";
import { ButtonTooltip } from "@ui/components/button-tooltip";
import { useCameraControls } from "../motion/useCameraControls.js";

type GraphControlsProps = {
  /** Center camera on the current tab's node. Disabled when no such node. */
  onCenterCurrent: () => void;
  canCenterCurrent: boolean;
};

export function GraphControls({ onCenterCurrent, canCenterCurrent }: GraphControlsProps) {
  const { zoomIn, zoomOut } = useReactFlow();
  const { smoothFitView } = useCameraControls();

  return (
    <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-1.5">
      <ButtonTooltip label="Zoom in" side="left">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Zoom in"
          onClick={() => zoomIn({ duration: 200 })}
        >
          <Icons.Plus />
        </Button>
      </ButtonTooltip>
      <ButtonTooltip label="Zoom out" side="left">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Zoom out"
          onClick={() => zoomOut({ duration: 200 })}
        >
          <Icons.Minus />
        </Button>
      </ButtonTooltip>
      <ButtonTooltip label="Center on current tab" side="left">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Center on current tab"
          disabled={!canCenterCurrent}
          onClick={onCenterCurrent}
        >
          <Icons.LocateFixed />
        </Button>
      </ButtonTooltip>
      <ButtonTooltip label="Fit whole graph" side="left">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Fit whole graph"
          onClick={() => smoothFitView()}
        >
          <Icons.Maximize />
        </Button>
      </ButtonTooltip>
    </div>
  );
}
