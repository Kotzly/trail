import { theme } from "../theme";

/**
 * Radial vignette overlay -- dark edges, transparent center.
 * Pulls viewer focus toward the center of frame.
 */
export const Vignette: React.FC = () => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 90,
        background: `radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, ${theme.void}88 70%, ${theme.void} 100%)`,
      }}
    />
  );
};
