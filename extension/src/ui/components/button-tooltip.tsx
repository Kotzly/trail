import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { Kbd, KbdGroup } from "@ui/components/ui/kbd";

type Side = "top" | "bottom" | "left" | "right";

type ButtonTooltipProps = {
  /** Visible label. Plain text or rich content. */
  label: React.ReactNode;
  /** Pre-formatted shortcut tokens (e.g. ["⌘", "K"] on mac, ["Ctrl", "K"]
   *  on Windows). Each token renders as its own <Kbd> badge inside a
   *  <KbdGroup>. Pass an empty array or omit when there is no shortcut. */
  keys?: readonly string[];
  /** Tooltip placement. Defaults to bottom — matches the project's prior
   *  data-tooltip default. */
  side?: Side;
  /** The trigger element. Passed through `asChild`, so it must accept a
   *  ref and forward DOM props (a `<Button>` works out of the box). */
  children: React.ReactElement;
};

/**
 * Drop-in wrapper around shadcn's `Tooltip` for the "icon button +
 * keyboard shortcut" pattern. Replaces the project's prior custom
 * `data-tooltip` attribute approach with proper Radix tooltip + `<Kbd>`
 * badges so shortcut keys render as styled chips, not embedded text.
 *
 * Usage:
 *   <ButtonTooltip label="Undo" keys={["⌘", "Z"]}>
 *     <Button onClick={...}><UndoIcon /></Button>
 *   </ButtonTooltip>
 *
 * The trigger receives `aria-describedby` automatically from Radix; the
 * caller still owns `aria-label` for the accessible name (the tooltip
 * is a description, not the name).
 */
export function ButtonTooltip({ label, keys, side = "bottom", children }: ButtonTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        <span>{label}</span>
        {keys && keys.length > 0 && (
          <KbdGroup>
            {keys.map((token, idx) => (
              <Kbd key={`${token}-${idx}`}>{token}</Kbd>
            ))}
          </KbdGroup>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
