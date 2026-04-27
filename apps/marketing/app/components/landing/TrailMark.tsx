import { useId } from "react";

const PATHS = [
  "M28.13,32.94c14.54,1.86,18.42,8.36,23.83,17.32s-11.6,11.44-5.43,24.84",
  "M75.13,62.06c-3.27-14.97-15.03,0-23.17-11.8",
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

export function TrailMark({
  size = 32,
  glow = false,
}: {
  size?: number;
  glow?: boolean;
}) {
  const id = useId();
  const gradId = `${id}-grad`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      role="img"
      aria-label="Trail"
      style={
        glow
          ? { filter: "drop-shadow(0 0 14px rgba(248, 211, 100, 0.35))" }
          : undefined
      }
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8d364" />
          <stop offset="0.45" stopColor="#d1524e" />
          <stop offset="0.85" stopColor="#d2345c" />
          <stop offset="1" stopColor="#88223a" />
        </linearGradient>
      </defs>
      <rect
        width="128"
        height="128"
        rx="30"
        ry="30"
        fill="rgba(20, 17, 12, 0.8)"
        stroke="rgba(248, 211, 100, 0.18)"
        strokeWidth="1"
      />
      <g
        stroke={`url(#${gradId})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {PATHS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fill={`url(#${gradId})`}>
        {NODES.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="4.4" />
        ))}
      </g>
    </svg>
  );
}
