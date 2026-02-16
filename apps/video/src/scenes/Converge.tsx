import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { VoidBackground } from "../components/VoidBackground";
import { ShareCard } from "../components/ShareCard";
import { TrackedText } from "../components/TrackedText";
import { theme } from "../theme";
import { SPRING_SMOOTH, SPRING_SNAPPY } from "../lib/springs";
import { seededRandom } from "../lib/noise";

const rand = seededRandom(333);

const CX = 960;
const CY = 480;

/** Scattered node positions that converge to center */
const scatterNodes = Array.from({ length: 15 }, () => ({
  startX: CX + (rand() - 0.5) * 800,
  startY: CY + (rand() - 0.5) * 500,
}));

const CONVERGE_START = 0;
const CONVERGE_END = 60;
const PULSE_FRAME = 70;
const CARD_ENTER = 90;
const TEXT_ENTER = 150;

/**
 * Scene 6: Converge (frames 0-300 local, 1260-1560 globally)
 * All nodes drift toward center, compress into a single point,
 * which expands into the share card.
 */
export const Converge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Convergence spring
  const convergeProgress = spring({
    frame: Math.max(0, frame - CONVERGE_START),
    fps,
    config: SPRING_SMOOTH,
  });

  // Pulse at center
  const pulseScale = frame >= PULSE_FRAME && frame < CARD_ENTER
    ? interpolate(
        frame,
        [PULSE_FRAME, PULSE_FRAME + 8, PULSE_FRAME + 16],
        [1, 2.5, 0],
        { extrapolateRight: "clamp" },
      )
    : 0;

  const pulseOpacity = frame >= PULSE_FRAME && frame < CARD_ENTER
    ? interpolate(
        frame,
        [PULSE_FRAME, PULSE_FRAME + 16],
        [0.8, 0],
        { extrapolateRight: "clamp" },
      )
    : 0;

  // Nodes fade out as they converge
  const nodeOpacity = interpolate(frame, [40, 65], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Card fade
  const cardFadeOut = interpolate(frame, [250, 280], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <VoidBackground>
      {/* Converging nodes */}
      {scatterNodes.map((node, i) => {
        const x = node.startX + (CX - node.startX) * convergeProgress;
        const y = node.startY + (CY - node.startY) * convergeProgress;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: theme.amber,
              opacity: nodeOpacity,
              transform: "translate(-50%, -50%)",
              boxShadow: `0 0 12px ${theme.amber}60`,
            }}
          />
        );
      })}

      {/* Center pulse */}
      <div
        style={{
          position: "absolute",
          left: CX,
          top: CY,
          width: 20,
          height: 20,
          borderRadius: "50%",
          backgroundColor: theme.amberHot,
          transform: `translate(-50%, -50%) scale(${pulseScale})`,
          opacity: pulseOpacity,
          boxShadow: `0 0 40px ${theme.amberHot}`,
        }}
      />

      {/* Share card */}
      <div style={{ opacity: cardFadeOut }}>
        <ShareCard enterFrame={CARD_ENTER} cx={CX} cy={CY - 30} />
      </div>

      {/* "ONE LINK. FULL CONTEXT." */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 120,
          display: "flex",
          justifyContent: "center",
          opacity: cardFadeOut,
        }}
      >
        <TrackedText
          text="ONE LINK. FULL CONTEXT."
          enterFrame={TEXT_ENTER}
          fontSize={28}
        />
      </div>
    </VoidBackground>
  );
};
