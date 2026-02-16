import { useCurrentFrame } from "remotion";
import { theme } from "../theme";

/**
 * Full-screen animated film grain overlay using SVG feTurbulence.
 * The seed changes every frame for organic noise movement.
 * Sits as top-most layer at ~3-4% opacity.
 */
export const FilmGrain: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = frame % 1000;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 100,
        mixBlendMode: "screen",
        opacity: 0.04,
      }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id={`grain-${seed}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves={3}
            seed={seed}
            stitchTiles="stitch"
          />
          <feColorMatrix
            type="saturate"
            values="0"
          />
        </filter>
        <rect
          width="100%"
          height="100%"
          filter={`url(#grain-${seed})`}
          fill={theme.grain}
        />
      </svg>
    </div>
  );
};
