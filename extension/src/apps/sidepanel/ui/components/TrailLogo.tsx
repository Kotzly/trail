import { useId } from "react";

export type TrailLogoProps = {
  className?: string;
  animated?: boolean;
  label?: string;
};

export default function TrailLogo({ className, animated = false, label }: TrailLogoProps) {
  const id = useId();
  const nodeId = `${id}-node`;
  const glowId = `${id}-glow`;
  const classes = ["trail-logo", animated ? "trail-logo--loop" : null, className]
    .filter(Boolean)
    .join(" ");
  const ariaProps = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };

  return (
    <svg
      className={classes}
      viewBox="0 0 188.16 188.16"
      fill="none"
      focusable="false"
      {...ariaProps}
    >
      <defs>
        <radialGradient id={nodeId} cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="var(--trail-logo-accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--trail-logo-accent)" stopOpacity="1" />
        </radialGradient>
        <radialGradient id={glowId} cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="var(--trail-logo-accent)" stopOpacity="0" />
          <stop offset="38%" stopColor="var(--trail-logo-accent)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--trail-logo-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g
        stroke="var(--trail-logo-border)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      >
        <path d="M53.23 43.64 C74.6 46.37 80.31 55.93 88.26 69.09" />
        <path d="M88.26 69.09 C96.21 82.27 71.21 85.9 80.28 105.61" />
        <path d="M88.26 69.09 C100.23 86.44 117.51 64.44 122.32 86.44" />
        <path d="M80.28 105.61 C92.28 112.09 98.19 122.06 99.02 134.95" />
        <path d="M122.32 86.44 C122.29 104.7 124.23 121.71 137.5 131.58" />
        <path d="M122.32 86.44 C137.9 86.53 150.02 94.53 158.69 110.44" />
      </g>

      <g
        stroke="var(--trail-logo-accent)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M53.23 43.64 C74.6 46.37 80.31 55.93 88.26 69.09"
          pathLength="1"
          className="trail-logo__sparkPath"
          style={{ "--trail-logo-delay": "0ms" } as React.CSSProperties}
        />
        <path
          d="M88.26 69.09 C96.21 82.27 71.21 85.9 80.28 105.61"
          pathLength="1"
          className="trail-logo__sparkPath"
          style={{ "--trail-logo-delay": "520ms" } as React.CSSProperties}
        />
        <path
          d="M88.26 69.09 C100.23 86.44 117.51 64.44 122.32 86.44"
          pathLength="1"
          className="trail-logo__sparkPath"
          style={{ "--trail-logo-delay": "520ms" } as React.CSSProperties}
        />
        <path
          d="M80.28 105.61 C92.28 112.09 98.19 122.06 99.02 134.95"
          pathLength="1"
          className="trail-logo__sparkPath"
          style={{ "--trail-logo-delay": "1040ms" } as React.CSSProperties}
        />
        <path
          d="M122.32 86.44 C122.29 104.7 124.23 121.71 137.5 131.58"
          pathLength="1"
          className="trail-logo__sparkPath"
          style={{ "--trail-logo-delay": "1040ms" } as React.CSSProperties}
        />
        <path
          d="M122.32 86.44 C137.9 86.53 150.02 94.53 158.69 110.44"
          pathLength="1"
          className="trail-logo__sparkPath"
          style={{ "--trail-logo-delay": "1040ms" } as React.CSSProperties}
        />
      </g>

      <g fill={`url(#${glowId})`} pointerEvents="none">
        <circle
          cx="53.23"
          cy="43.64"
          r="14"
          className="trail-logo__nodeGlow"
          style={{ "--trail-logo-delay": "0ms" } as React.CSSProperties}
        />
        <circle
          cx="88.26"
          cy="69.09"
          r="14"
          className="trail-logo__nodeGlow"
          style={{ "--trail-logo-delay": "520ms" } as React.CSSProperties}
        />
        <circle
          cx="122.32"
          cy="86.44"
          r="14"
          className="trail-logo__nodeGlow"
          style={{ "--trail-logo-delay": "1040ms" } as React.CSSProperties}
        />
        <circle
          cx="80.28"
          cy="105.61"
          r="14"
          className="trail-logo__nodeGlow"
          style={{ "--trail-logo-delay": "1040ms" } as React.CSSProperties}
        />
        <circle
          cx="99.02"
          cy="134.95"
          r="14"
          className="trail-logo__nodeGlow"
          style={{ "--trail-logo-delay": "1280ms" } as React.CSSProperties}
        />
        <circle
          cx="158.69"
          cy="110.44"
          r="14"
          className="trail-logo__nodeGlow"
          style={{ "--trail-logo-delay": "1280ms" } as React.CSSProperties}
        />
        <circle
          cx="137.5"
          cy="131.58"
          r="14"
          className="trail-logo__nodeGlow"
          style={{ "--trail-logo-delay": "1280ms" } as React.CSSProperties}
        />
      </g>

      <g fill={`url(#${nodeId})`}>
        <circle cx="53.23" cy="43.64" r="7" />
        <circle cx="88.26" cy="69.09" r="7" />
        <circle cx="122.32" cy="86.44" r="7" />
        <circle cx="80.28" cy="105.61" r="7" />
        <circle cx="99.02" cy="134.95" r="7" />
        <circle cx="137.5" cy="131.58" r="7" />
        <circle cx="158.69" cy="110.44" r="7" />
      </g>
    </svg>
  );
}
