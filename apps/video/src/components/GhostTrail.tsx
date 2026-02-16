import { theme } from "../theme";

interface GhostTrailProps {
  /** Array of past positions, most recent last */
  positions: Array<{ x: number; y: number }>;
  /** Max number of ghost copies to render */
  maxGhosts?: number;
  radius?: number;
}

/**
 * Decaying afterimage trail for morphing nodes.
 * Renders ghost echoes at decreasing opacity.
 */
export const GhostTrail: React.FC<GhostTrailProps> = ({
  positions,
  maxGhosts = 8,
  radius = 5,
}) => {
  const ghosts = positions.slice(-maxGhosts);

  return (
    <>
      {ghosts.map((pos, i) => {
        const age = ghosts.length - i;
        const opacity = Math.max(0, 0.4 * (1 - age / maxGhosts));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: radius * 2,
              height: radius * 2,
              borderRadius: "50%",
              backgroundColor: theme.amber,
              opacity,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              filter: `blur(${age * 0.5}px)`,
            }}
          />
        );
      })}
    </>
  );
};
