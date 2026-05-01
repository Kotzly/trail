export type FaviconKind = "newtab" | "wiki" | "arxiv" | "so" | "yt" | "gh";

const STYLES: Record<
  FaviconKind,
  { bg: string; fg: string; label: string; serif?: boolean }
> = {
  newtab: { bg: "#3b3a36", fg: "#f6efe1", label: "·" },
  wiki: { bg: "#fff", fg: "#000", label: "W", serif: true },
  arxiv: { bg: "#b31b1b", fg: "#fff", label: "χ" },
  so: { bg: "#f48024", fg: "#fff", label: "S" },
  yt: { bg: "#ff0033", fg: "#fff", label: "▶" },
  gh: { bg: "#24292f", fg: "#fff", label: "●" },
};

export function Favicon({
  kind,
  size = 14,
}: {
  kind: FaviconKind;
  size?: number;
}) {
  const s = STYLES[kind];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        display: "inline-grid",
        placeItems: "center",
        flexShrink: 0,
        fontWeight: 700,
        fontSize: Math.round(size * 0.6),
        color: s.fg,
        background: s.bg,
        fontFamily: s.serif ? "Georgia, serif" : "var(--font-sans)",
        lineHeight: 1,
      }}
    >
      {s.label}
    </div>
  );
}
