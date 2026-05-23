import { useReactFlow } from "@xyflow/react";
import { Icons } from "@ui/components/icons";
import { Button } from "@ui/components/ui/button";
import { ButtonTooltip } from "@ui/components/button-tooltip";

type GraphControlsProps = {
  /**
   * Focus the current node, falling back to the last-visited node (or
   * root) when no tab is active. Disabled only when neither has landed
   * in the layout yet.
   */
  onFocusCurrentOrFallback: () => void;
  canFocus: boolean;
};

export function GraphControls({ onFocusCurrentOrFallback, canFocus }: GraphControlsProps) {
  const { zoomIn, zoomOut } = useReactFlow();

  return (
    <div className="absolute right-3 bottom-3 z-10 flex flex-col gap-1.5">
      <ButtonTooltip label="Zoom in" side="left">
        <Button
          variant="outline"
          size="icon"
          aria-label="Zoom in"
          onClick={() => zoomIn({ duration: 200 })}
        >
          <Icons.Plus />
        </Button>
      </ButtonTooltip>
      <ButtonTooltip label="Zoom out" side="left">
        <Button
          variant="outline"
          size="icon"
          aria-label="Zoom out"
          onClick={() => zoomOut({ duration: 200 })}
        >
          <Icons.Minus />
        </Button>
      </ButtonTooltip>
      <ButtonTooltip label="Focus current node" side="left">
        <Button
          variant="outline"
          size="icon"
          aria-label="Focus current node"
          disabled={!canFocus}
          onClick={onFocusCurrentOrFallback}
        >
          <Icons.LocateFixed />
        </Button>
      </ButtonTooltip>
    </div>
  );
}
