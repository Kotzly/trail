import { interpolate, useCurrentFrame } from "remotion";
import { VoidBackground } from "../components/VoidBackground";
import { WhisperText } from "../components/WhisperText";
import { theme } from "../theme";
import { noise2D, seededRandom } from "../lib/noise";

const MAX_PARTICLES = 220;
const rand = seededRandom(99);

interface ChaosParticle {
  baseX: number;
  baseY: number;
  size: number;
  speedX: number;
  speedY: number;
  noiseOff: number;
  spawnFrame: number;
}

const allParticles: ChaosParticle[] = Array.from(
  { length: MAX_PARTICLES },
  (_, i) => ({
    baseX: rand() * 1920,
    baseY: rand() * 1080,
    size: 1.5 + rand() * 3.5,
    speedX: (rand() - 0.5) * 4,
    speedY: (rand() - 0.5) * 4,
    noiseOff: rand() * 500,
    spawnFrame: Math.floor(rand() * 60),
  }),
);

/**
 * Scene 2: Chaos (frames 0-150 in local time, 120-270 globally)
 * Particles multiply rapidly. At peak density, everything freezes.
 * The word "lost." fades in.
 */
export const Chaos: React.FC = () => {
  const frame = useCurrentFrame();

  const particleCount = Math.min(
    Math.floor(interpolate(frame, [0, 60], [40, MAX_PARTICLES], {
      extrapolateRight: "clamp",
    })),
    MAX_PARTICLES,
  );

  const isFrozen = frame >= 80 && frame <= 92;

  const speedMultiplier = isFrozen
    ? 0
    : interpolate(frame, [0, 50, 92, 130], [0.3, 2.5, 2.5, 0.5], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  const lostOpacity = interpolate(frame, [82, 95, 120, 140], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <VoidBackground>
      {allParticles.slice(0, particleCount).map((p, i) => {
        const localSpawn = frame - p.spawnFrame;
        if (localSpawn < 0) return null;

        const time = localSpawn * 0.03 * speedMultiplier;
        const nx = noise2D(p.noiseOff + time * 10, i * 0.1);
        const ny = noise2D(i * 0.1, p.noiseOff + time * 10);

        const x = p.baseX + (nx - 0.5) * 400 + p.speedX * localSpawn * speedMultiplier;
        const y = p.baseY + (ny - 0.5) * 400 + p.speedY * localSpawn * speedMultiplier;

        const wrapX = ((x % 1920) + 1920) % 1920;
        const wrapY = ((y % 1080) + 1080) % 1080;

        const opacity = interpolate(
          frame,
          [0, 40, 80],
          [0.15, 0.35, 0.45],
          { extrapolateRight: "clamp" },
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: wrapX,
              top: wrapY,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: theme.ink,
              opacity,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}

      {/* "lost." text */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: lostOpacity,
          zIndex: 50,
        }}
      >
        <WhisperText text="lost." fontSize={72} color={theme.inkMuted} />
      </div>
    </VoidBackground>
  );
};
