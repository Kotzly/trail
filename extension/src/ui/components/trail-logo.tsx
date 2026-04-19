import { useId } from "react";
import "./trail-logo.css";

export type TrailLogoVariant = "empty" | "field" | "dark" | "light";

export type TrailLogoProps = {
  className?: string;
  animated?: boolean;
  label?: string;
  variant?: TrailLogoVariant;
};

const PATHS = [
  "M28.13,32.94c14.54,1.86,18.42,8.36,23.83,17.32s-11.6,11.44-5.43,24.84",
  "M51.96,50.26 C60.1,62.06 71.86,47.09 75.13,62.06",
  "M46.53,75.1c8.16,4.41,12.18,11.19,12.75,19.96",
  "M75.13,62.06c-.02,12.42,1.3,23.99,10.33,30.7",
  "M75.13,62.06c10.6.06,18.84,5.5,24.73,16.32",
] as const;

const NODES: Array<[number, number]> = [
  [28.13, 32.94],
  [51.96, 50.26],
  [75.13, 62.06],
  [46.53, 75.1],
  [59.28, 95.06],
  [85.46, 92.77],
  [99.87, 78.38],
];

const SPARK_DELAY_MS = [0, 300, 600, 900, 900];
const NODE_DELAY_MS = [0, 300, 900, 600, 1200, 1500, 1500];

export default function TrailLogo({
  className,
  animated = false,
  label,
  variant = "empty",
}: TrailLogoProps) {
  const id = useId();
  const gradId = `${id}-grad`;

  const classes = [
    "trail-logo",
    `trail-logo--${variant}`,
    animated ? "trail-logo--loop" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const ariaProps = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  const isField = variant === "field";
  const hasBackground = variant !== "empty";
  const strokeColor = isField ? `url(#${gradId})` : undefined;

  return (
    <svg className={classes} viewBox="0 0 128 128" fill="none" focusable="false" {...ariaProps}>
      <defs>
        {isField ? (
          <linearGradient
            id={gradId}
            x1="0"
            y1="0.5"
            x2="1"
            y2="0.5"
            gradientUnits="objectBoundingBox"
          >
            <stop offset="0" stopColor="#f8d364" />
            <stop offset="0.4" stopColor="#d1524e" />
            <stop offset="0.7" stopColor="#d2345c" />
            <stop offset="0.8" stopColor="#88223a" />
            <stop offset="0.9" stopColor="#4d131e" />
            <stop offset="1" stopColor="#360e14" />
          </linearGradient>
        ) : null}
      </defs>

      {hasBackground ? (
        <rect width="128" height="128" rx="30" ry="30" fill="var(--trail-logo-bg)" />
      ) : null}

      <g
        className="trail-logo__base"
        stroke={strokeColor ?? "var(--trail-logo-border)"}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS.map((d, i) => (
          <path key={`base-${i}`} d={d} />
        ))}
      </g>

      <g
        stroke={strokeColor ?? "var(--trail-logo-accent)"}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS.map((d, i) => (
          <path
            key={`spark-${i}`}
            d={d}
            pathLength="1"
            className="trail-logo__sparkPath"
            style={{ "--trail-logo-delay": `${SPARK_DELAY_MS[i]}ms` } as React.CSSProperties}
          />
        ))}
      </g>

      <g fill="var(--trail-logo-node)">
        {NODES.map(([cx, cy], i) => (
          <circle
            key={`node-${i}`}
            cx={cx}
            cy={cy}
            r="4.76"
            className="trail-logo__node"
            style={{ "--trail-logo-delay": `${NODE_DELAY_MS[i]}ms` } as React.CSSProperties}
          />
        ))}
      </g>
    </svg>
  );
}
