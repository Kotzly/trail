import { AbsoluteFill } from "remotion";

/**
 * Scene content container using AbsoluteFill.
 * Background is transparent so the persistent AmbientField
 * and base void color in TrailDemo show through.
 *
 * Vignette and FilmGrain are applied at the composition level
 * in TrailDemo.tsx to ensure consistent coverage across transitions.
 */
export const VoidBackground: React.FC<{
  children?: React.ReactNode;
}> = ({ children }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      {children}
    </AbsoluteFill>
  );
};
