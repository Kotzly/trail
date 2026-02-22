"use client";

import ColorBends from "./ui/color-bends";

export function PageBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[120svh]"
      style={{
        maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, black 50%, transparent 100%)",
      }}
    >
      <ColorBends
        style={{ position: "absolute", inset: 0 }}
        colors={["#C2174B", "#C37A30", "#FDD57E"]}
        speed={0.15}
        noise={0.05}
        mouseInfluence={0.5}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,_transparent_0%,_rgba(0,0,0,0.9)_100%)]" />
    </div>
  );
}
