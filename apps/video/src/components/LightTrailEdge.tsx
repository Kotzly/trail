import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

interface LightTrailEdgeProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Frame at which this edge starts drawing */
  enterFrame?: number;
  /** How many frames the draw-on takes */
  drawDuration?: number;
  /** Whether the edge glows amber or stays dormant */
  lit?: boolean;
  /** Opacity override */
  opacity?: number;
}

/**
 * An animated connection line between two nodes.
 * Draws on with a stroke-dashoffset animation and glows amber when lit.
 */
export const LightTrailEdge: React.FC<LightTrailEdgeProps> = ({
  x1,
  y1,
  x2,
  y2,
  enterFrame = 0,
  drawDuration = 15,
  lit = true,
  opacity: opacityOverride,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - enterFrame;
  if (localFrame < 0) return null;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);

  const drawProgress = interpolate(
    localFrame,
    [0, drawDuration],
    [0, 1],
    { extrapolateRight: "clamp" },
  );

  const edgeOpacity = opacityOverride ?? interpolate(
    localFrame,
    [0, 6],
    [0, 1],
    { extrapolateRight: "clamp" },
  );

  const strokeColor = lit ? theme.amber : theme.edgeLine;
  const glowFilter = lit
    ? `drop-shadow(0 0 4px ${theme.amber}80)`
    : "none";

  const dashOffset = length * (1 - drawProgress);

  return (
    <svg
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        pointerEvents: "none",
        opacity: edgeOpacity,
        filter: glowFilter,
      }}
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={strokeColor}
        strokeWidth={lit ? 1.5 : 1}
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={dashOffset}
      />
    </svg>
  );
};
