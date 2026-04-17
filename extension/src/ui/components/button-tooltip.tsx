import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { Shortcut, type ShortcutKey } from "@ui/components/shortcut";

type Side = "top" | "bottom" | "left" | "right";

type ButtonTooltipProps = {
  /** Visible label. Plain text or rich content. */
  label: React.ReactNode;
  /** Semantic shortcut tokens — `"meta" | "shift" | "alt" | "ctrl"` plus
   *  special keys and literals. Rendered via <Shortcut>, which picks
   *  platform-correct glyphs (⌘/⇧ on Mac, Ctrl/Shift on Win/Linux).
   *  Omit when there is no shortcut. */
  keys?: readonly ShortcutKey[];
  /** Tooltip placement. Defaults to bottom. */
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
        {keys && keys.length > 0 && <Shortcut keys={keys} />}
      </TooltipContent>
    </Tooltip>
  );
}
