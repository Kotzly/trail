import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { VoidBackground } from "../components/VoidBackground";
import { LuminousNode } from "../components/LuminousNode";
import { LightTrailEdge } from "../components/LightTrailEdge";
import { TrailLogo } from "../components/TrailLogo";
import { TrackedText } from "../components/TrackedText";
import { WhisperText } from "../components/WhisperText";
import { theme } from "../theme";
import { seededRandom } from "../lib/noise";


const rand = seededRandom(7);

/**
 * The chain of particles that "light up" and form the initial path.
 * Positions are hand-tuned to form a small branching tree near center.
 */
const chainNodes = [
  { id: "p0", x: 960, y: 440 },
  { id: "p1", x: 860, y: 380 },
  { id: "p2", x: 780, y: 320 },
  { id: "p3", x: 1050, y: 390 },
  { id: "p4", x: 1140, y: 350 },
  { id: "p5", x: 900, y: 510 },
  { id: "p6", x: 830, y: 570 },
  { id: "p7", x: 1020, y: 520 },
  { id: "p8", x: 1100, y: 560 },
];

const chainEdges = [
  { from: 0, to: 1 },
  { from: 1, to: 2 },
  { from: 0, to: 3 },
  { from: 3, to: 4 },
  { from: 0, to: 5 },
  { from: 5, to: 6 },
  { from: 0, to: 7 },
  { from: 7, to: 8 },
];

const IGNITE_INTERVAL = 10;

/** Background particles that fade away */
const bgParticleCount = 60;
const bgParticles = Array.from({ length: bgParticleCount }, () => ({
  x: rand() * 1920,
  y: rand() * 1080,
  size: 1.5 + rand() * 2,
}));

/**
 * Scene 3: Emergence (frames 0-270 in local time, 270-540 globally)
 * One particle glows amber. A chain reaction connects particles into a tree.
 * Then the Trail logo draws in with the tagline.
 */
export const Emergence: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgFade = interpolate(frame, [20, 80], [0.15, 0.03], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logoStart = 120;
  const textStart = 180;
  const taglineStart = 200;

  const chainFadeOut = interpolate(
    frame,
    [logoStart - 10, logoStart + 20],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <VoidBackground>
      {/* Background particles fading away */}
      {bgParticles.map((p, i) => (
        <div
          key={`bg-${i}`}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: theme.ink,
            opacity: bgFade,
            transform: "translate(-50%, -50%)",
            filter: "blur(0.5px)",
          }}
        />
      ))}

      {/* Chain reaction: edges drawing on */}
      <div style={{ opacity: chainFadeOut }}>
        {chainEdges.map((edge, i) => {
          const edgeFrame = (edge.from + 1) * IGNITE_INTERVAL + 5;
          return (
            <LightTrailEdge
              key={`edge-${i}`}
              x1={chainNodes[edge.from].x}
              y1={chainNodes[edge.from].y}
              x2={chainNodes[edge.to].x}
              y2={chainNodes[edge.to].y}
              enterFrame={edgeFrame}
              drawDuration={12}
              lit
            />
          );
        })}

        {/* Chain reaction: nodes lighting up */}
        {chainNodes.map((node, i) => (
          <LuminousNode
            key={node.id}
            x={node.x}
            y={node.y}
            enterFrame={i * IGNITE_INTERVAL}
            lit
            radius={5}
          />
        ))}
      </div>

      {/* Trail logo drawing in */}
      <TrailLogo
        enterFrame={logoStart}
        drawDuration={50}
        size={140}
        cx={960}
        cy={420}
      />

      {/* "TRAIL" text */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 510,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <TrackedText
          text="TRAIL"
          enterFrame={textStart}
          fontSize={36}
          letterSpacing="0.3em"
        />
      </div>

      {/* Tagline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 560,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <WhisperText
          text="turn browsing into paths"
          enterFrame={taglineStart}
          fontSize={28}
          color={theme.inkMuted}
        />
      </div>
    </VoidBackground>
  );
};
