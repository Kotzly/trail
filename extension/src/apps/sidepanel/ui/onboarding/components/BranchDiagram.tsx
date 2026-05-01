import "./branch-diagram.css";

const W = 260;
const H = 148;
const NODES = {
  root: { x: 130, y: 28, label: "Research" },
  left: { x: 58, y: 100, label: "Kyoto" },
  right: { x: 202, y: 100, label: "Tokyo" },
} as const;

const NODE_R = 9;
const GLOW_R = 18;

// Delays (ms) for the choreographed build: root → left → right → fork caption.
const D = { root: 0, left: 260, right: 820, fork: 1120 } as const;

export function BranchDiagram() {
  return (
    <div className="bg-muted/40 relative overflow-hidden border">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="branch-diagram block h-auto w-full"
        role="img"
        aria-label="Diagram: a research node branches into two children — Kyoto and Tokyo"
      >
        <defs>
          <radialGradient id="branchNodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
            <stop offset="70%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Edges — root to left, root to right */}
        <path
          className="branch-diagram__edge"
          style={{ animationDelay: `${D.left + 100}ms` }}
          d={`M ${NODES.root.x} ${NODES.root.y + NODE_R} C ${NODES.root.x - 10} ${NODES.root.y + 36}, ${NODES.left.x + 10} ${NODES.left.y - 36}, ${NODES.left.x} ${NODES.left.y - NODE_R}`}
          stroke="var(--ring)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          pathLength="1"
        />
        <path
          className="branch-diagram__edge"
          style={{ animationDelay: `${D.right + 100}ms` }}
          d={`M ${NODES.root.x} ${NODES.root.y + NODE_R} C ${NODES.root.x + 10} ${NODES.root.y + 36}, ${NODES.right.x - 10} ${NODES.right.y - 36}, ${NODES.right.x} ${NODES.right.y - NODE_R}`}
          stroke="var(--ring)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          pathLength="1"
        />

        {/* Glow + node pairs */}
        {(["root", "left", "right"] as const).map((key) => {
          const n = NODES[key];
          const delay = D[key];
          return (
            <g key={key}>
              <circle
                className="branch-diagram__glow"
                style={{ animationDelay: `${delay}ms`, transformOrigin: `${n.x}px ${n.y}px` }}
                cx={n.x}
                cy={n.y}
                r={GLOW_R}
                fill="url(#branchNodeGlow)"
              />
              <circle
                className="branch-diagram__node"
                style={{ animationDelay: `${delay}ms`, transformOrigin: `${n.x}px ${n.y}px` }}
                cx={n.x}
                cy={n.y}
                r={NODE_R}
                fill="var(--card)"
                stroke="var(--primary)"
                strokeWidth="2"
              />
            </g>
          );
        })}

        {/* Labels */}
        <text
          className="branch-diagram__label"
          style={{ animationDelay: `${D.root + 80}ms` }}
          x={NODES.root.x}
          y={NODES.root.y - NODE_R - 6}
          textAnchor="middle"
        >
          Research
        </text>
        <text
          className="branch-diagram__label branch-diagram__label--muted"
          style={{ animationDelay: `${D.left + 260}ms` }}
          x={NODES.left.x}
          y={NODES.left.y + NODE_R + 14}
          textAnchor="middle"
        >
          Kyoto
        </text>
        <text
          className="branch-diagram__label branch-diagram__label--muted"
          style={{ animationDelay: `${D.right + 260}ms` }}
          x={NODES.right.x}
          y={NODES.right.y + NODE_R + 14}
          textAnchor="middle"
        >
          Tokyo
        </text>

        {/* Fork annotation — a thin bracket + caption, appears last */}
        <g className="branch-diagram__fork" style={{ animationDelay: `${D.fork}ms` }}>
          <path
            d={`M ${NODES.left.x + 12} ${NODES.left.y - 18} Q ${NODES.root.x} ${NODES.root.y + 28}, ${NODES.right.x - 12} ${NODES.right.y - 18}`}
            stroke="var(--muted-foreground)"
            strokeWidth="0.75"
            strokeDasharray="2 2"
            fill="none"
            opacity="0.6"
          />
          <text
            x={NODES.root.x}
            y={NODES.root.y + 38}
            textAnchor="middle"
            className="fill-muted-foreground text-[8px]"
          >
            fork
          </text>
        </g>
      </svg>
    </div>
  );
}
