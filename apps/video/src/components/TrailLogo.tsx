import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

interface TrailLogoProps {
  /** Frame at which the logo starts drawing */
  enterFrame?: number;
  /** Duration of the full draw-in animation in frames */
  drawDuration?: number;
  /** Size of the logo (width & height) */
  size?: number;
  /** Center X position */
  cx?: number;
  /** Center Y position */
  cy?: number;
  /** Opacity override */
  opacity?: number;
}

/**
 * The Trail fork logo, drawn with an animated stroke-dashoffset.
 * Paths from the actual brand SVG, adapted for amber stroke rendering.
 */
export const TrailLogo: React.FC<TrailLogoProps> = ({
  enterFrame = 0,
  drawDuration = 60,
  size = 160,
  cx = 960,
  cy = 440,
  opacity: opacityOverride,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - enterFrame;
  if (localFrame < 0) return null;

  const drawProgress = interpolate(
    localFrame,
    [0, drawDuration],
    [0, 1],
    { extrapolateRight: "clamp" },
  );

  const fadeIn = opacityOverride ?? interpolate(
    localFrame,
    [0, 15],
    [0, 1],
    { extrapolateRight: "clamp" },
  );

  const circleProgress = interpolate(
    localFrame,
    [drawDuration * 0.6, drawDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const paths = [
    "M28.13,32.94c14.54,1.86,18.42,8.36,23.83,17.32s-11.6,11.44-5.43,24.84",
    "M75.13,62.06c-3.27-14.97-15.03,0-23.17-11.8",
    "M46.53,75.1c8.16,4.41,12.18,11.19,12.75,19.96",
    "M75.13,62.06c-.02,12.42,1.3,23.99,10.33,30.7",
    "M75.13,62.06c10.6.06,18.84,5.5,24.73,16.32",
  ];

  const circles = [
    { cx: 28.13, cy: 32.94 },
    { cx: 51.96, cy: 50.26 },
    { cx: 75.13, cy: 62.06 },
    { cx: 46.53, cy: 75.1 },
    { cx: 59.28, cy: 95.06 },
    { cx: 85.46, cy: 92.77 },
    { cx: 99.87, cy: 78.38 },
  ];

  const pathLength = 200;

  return (
    <div
      style={{
        position: "absolute",
        left: cx - size / 2,
        top: cy - size / 2,
        width: size,
        height: size,
        opacity: fadeIn,
      }}
    >
      <svg
        viewBox="0 0 128 128"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Paths with draw-on animation */}
        {paths.map((d, i) => {
          const stagger = i * (drawDuration * 0.08);
          const pathProgress = interpolate(
            localFrame - stagger,
            [0, drawDuration * 0.7],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={theme.amber}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.8}
              strokeDasharray={pathLength}
              strokeDashoffset={pathLength * (1 - pathProgress)}
              filter={`drop-shadow(0 0 3px ${theme.amber}60)`}
            />
          );
        })}
        {/* Node circles */}
        {circles.map((c, i) => (
          <circle
            key={i}
            cx={c.cx}
            cy={c.cy}
            r={4.2}
            fill={theme.ink}
            opacity={circleProgress}
            filter={`drop-shadow(0 0 4px ${theme.amber}40)`}
          />
        ))}
      </svg>
    </div>
  );
};
