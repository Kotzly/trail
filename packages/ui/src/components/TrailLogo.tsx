import { type CSSProperties, type FC } from "react";
import { cn } from "../utils/cn";

const delayStyles: Record<string, CSSProperties> = {
  "0ms": { "--trail-logo-delay": "0ms" } as CSSProperties,
  "520ms": { "--trail-logo-delay": "520ms" } as CSSProperties,
  "1040ms": { "--trail-logo-delay": "1040ms" } as CSSProperties,
  "1280ms": { "--trail-logo-delay": "1280ms" } as CSSProperties
};

const strokePaths = [
  "M53.23 43.64 C74.6 46.37 80.31 55.93 88.26 69.09",
  "M88.26 69.09 C96.21 82.27 71.21 85.9 80.28 105.61",
  "M88.26 69.09 C100.23 86.44 117.51 64.44 122.32 86.44",
  "M80.28 105.61 C92.28 112.09 98.19 122.06 99.02 134.95",
  "M122.32 86.44 C122.29 104.7 124.23 121.71 137.5 131.58",
  "M122.32 86.44 C137.9 86.53 150.02 94.53 158.69 110.44"
] as const;

const sparkPaths = [
  { d: strokePaths[0], delay: "0ms" },
  { d: strokePaths[1], delay: "520ms" },
  { d: strokePaths[2], delay: "520ms" },
  { d: strokePaths[3], delay: "1040ms" },
  { d: strokePaths[4], delay: "1040ms" },
  { d: strokePaths[5], delay: "1040ms" }
] as const;

const glowNodes = [
  { cx: 53.23, cy: 43.64, delay: "0ms" },
  { cx: 88.26, cy: 69.09, delay: "520ms" },
  { cx: 122.32, cy: 86.44, delay: "1040ms" },
  { cx: 80.28, cy: 105.61, delay: "1040ms" },
  { cx: 99.02, cy: 134.95, delay: "1280ms" },
  { cx: 158.69, cy: 110.44, delay: "1280ms" },
  { cx: 137.5, cy: 131.58, delay: "1280ms" }
] as const;

const nodePoints = [
  { cx: 53.23, cy: 43.64 },
  { cx: 88.26, cy: 69.09 },
  { cx: 122.32, cy: 86.44 },
  { cx: 80.28, cy: 105.61 },
  { cx: 99.02, cy: 134.95 },
  { cx: 137.5, cy: 131.58 },
  { cx: 158.69, cy: 110.44 }
] as const;

const glowRadius = 14;
const nodeRadius = 7;

export type TrailLogoVariant = "static" | "animated";

export type TrailLogoProps = {
  className?: string;
  variant?: TrailLogoVariant;
  label?: string;
};

type TrailLogoCompoundProps = Omit<TrailLogoProps, "variant">;

type TrailLogoComponent = FC<TrailLogoProps> & {
  Animated: FC<TrailLogoCompoundProps>;
  Static: FC<TrailLogoCompoundProps>;
};

const GLOW_GRADIENT_ID = "trail-logo-glow";

function TrailLogoBase({ className, variant = "static", label }: TrailLogoProps) {
  const isAnimated = variant === "animated";
  const ariaProps = label
    ? { role: "img", "aria-label": label }
    : { "aria-hidden": true };

  return (
    <svg
      className={cn(
        "trail-logo",
        isAnimated && "trail-logo--loop",
        !isAnimated && "trail-logo--hover",
        className
      )}
      viewBox="0 0 188.16 188.16"
      fill="none"
      focusable="false"
      {...ariaProps}
    >
      <defs>
        <radialGradient id={GLOW_GRADIENT_ID} cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="var(--trail-logo-accent)" stopOpacity="0" />
          <stop offset="38%" stopColor="var(--trail-logo-accent)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--trail-logo-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g
        className="trail-logo__paths"
        stroke="var(--trail-logo-border)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {strokePaths.map((path) => (
          <path key={path} d={path} />
        ))}
      </g>

      <g
        stroke="var(--trail-logo-accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {sparkPaths.map(({ d, delay }) => (
          <path
            key={`${d}-${delay}`}
            d={d}
            pathLength="1"
            className="trail-logo__sparkPath"
            style={delayStyles[delay]}
          />
        ))}
      </g>

      <g fill={`url(#${GLOW_GRADIENT_ID})`} pointerEvents="none">
        {glowNodes.map(({ cx, cy, delay }) => (
          <circle
            key={`${cx}-${cy}-${delay}`}
            cx={cx}
            cy={cy}
            r={glowRadius}
            className="trail-logo__nodeGlow"
            style={delayStyles[delay]}
          />
        ))}
      </g>

      <g fill="var(--trail-logo-accent)">
        {nodePoints.map(({ cx, cy }) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={nodeRadius} />
        ))}
      </g>
    </svg>
  );
}

export const TrailLogo = Object.assign(TrailLogoBase, {
  Animated: (props: TrailLogoCompoundProps) => (
    <TrailLogoBase {...props} variant="animated" />
  ),
  Static: (props: TrailLogoCompoundProps) => (
    <TrailLogoBase {...props} variant="static" />
  )
}) as TrailLogoComponent;

TrailLogo.displayName = "TrailLogo";
TrailLogo.Animated.displayName = "TrailLogo.Animated";
TrailLogo.Static.displayName = "TrailLogo.Static";
