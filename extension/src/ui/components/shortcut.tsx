import { cn } from "@ui/lib/utils";
import { Kbd, KbdGroup } from "@ui/components/ui/kbd";

export type ShortcutKey =
  | "meta"
  | "shift"
  | "alt"
  | "ctrl"
  | "enter"
  | "escape"
  | "tab"
  | "delete"
  | "backspace"
  | "space"
  | "up"
  | "down"
  | "left"
  | "right"
  | (string & {});

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform ?? navigator.userAgent;
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

const IS_MAC = detectMac();

const MAC_GLYPHS: Record<string, string> = {
  meta: "\u2318",
  shift: "\u21E7",
  alt: "\u2325",
  ctrl: "\u2303",
  enter: "\u21B5",
  escape: "Esc",
  tab: "\u21E5",
  delete: "\u2326",
  backspace: "\u232B",
  space: "\u2423",
  up: "\u2191",
  down: "\u2193",
  left: "\u2190",
  right: "\u2192",
};

const WIN_GLYPHS: Record<string, string> = {
  meta: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  ctrl: "Ctrl",
  enter: "Enter",
  escape: "Esc",
  tab: "Tab",
  delete: "Del",
  backspace: "\u232B",
  space: "Space",
  up: "\u2191",
  down: "\u2193",
  left: "\u2190",
  right: "\u2192",
};

export function resolveShortcutToken(token: string): string {
  const table = IS_MAC ? MAC_GLYPHS : WIN_GLYPHS;
  return table[token] ?? token;
}

type ShortcutProps = {
  keys: readonly ShortcutKey[];
  className?: string;
};

export function Shortcut({ keys, className }: ShortcutProps) {
  return (
    <KbdGroup className={cn("shrink-0", className)}>
      {keys.map((token, idx) => (
        <Kbd key={`${token}-${idx}`}>{resolveShortcutToken(token)}</Kbd>
      ))}
    </KbdGroup>
  );
}

export const IS_MAC_PLATFORM = IS_MAC;
