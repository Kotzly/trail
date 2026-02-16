import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { fonts } from "../theme";
import { SPRING_SNAPPY } from "../lib/springs";

interface LuminousNodeProps {
  x: number;
  y: number;
  label?: string;
  /** Frame at which this node enters */
  enterFrame?: number;
  /** Whether this node is "lit" (amber) vs dormant */
  lit?: boolean;
  /** Radius of the filled circle */
  radius?: number;
  /** Opacity override */
  opacity?: number;
}

/**
 * A graph node rendered as a luminous circle with a soft glow halo.
 * When `lit`, it glows amber. Otherwise, it's a muted point.
 */
export const LuminousNode: React.FC<LuminousNodeProps> = ({
  x,
  y,
  label,
  enterFrame = 0,
  lit = true,
  radius = 5,
  opacity: opacityOverride,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = frame - enterFrame;
  if (localFrame < 0) return null;

  const scale = spring({
    frame: localFrame,
    fps,
    config: SPRING_SNAPPY,
  });

  const nodeOpacity = opacityOverride ?? interpolate(localFrame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  const fillColor = lit ? theme.amber : theme.inkMuted;
  const glowColor = lit ? theme.amberGlow : "transparent";
  const glowSize = lit ? radius * 6 : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity: nodeOpacity,
      }}
    >
      {/* Glow halo */}
      {lit && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: glowSize,
            height: glowSize,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${theme.amber}40 0%, transparent 70%)`,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        />
      )}
      {/* Core circle */}
      <div
        style={{
          width: radius * 2,
          height: radius * 2,
          borderRadius: "50%",
          backgroundColor: fillColor,
          position: "relative",
          zIndex: 1,
          boxShadow: lit ? `0 0 ${radius * 2}px ${theme.amber}60` : "none",
        }}
      />
      {/* Label */}
      {label && (
        <div
          style={{
            position: "absolute",
            top: radius * 2 + 6,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: fonts.mono,
            fontSize: 10,
            color: theme.inkMuted,
            whiteSpace: "nowrap",
            letterSpacing: "0.02em",
            maxWidth: 100,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
