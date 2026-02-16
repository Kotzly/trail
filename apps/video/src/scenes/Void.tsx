import { useCurrentFrame } from "remotion";
import { VoidBackground } from "../components/VoidBackground";
import { theme } from "../theme";
import { noise2D, seededRandom } from "../lib/noise";

const PARTICLE_COUNT = 40;
const rand = seededRandom(42);

interface Particle {
  baseX: number;
  baseY: number;
  size: number;
  speed: number;
  noiseOffsetX: number;
  noiseOffsetY: number;
}

const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
  baseX: rand() * 1920,
  baseY: rand() * 1080,
  size: 1.5 + rand() * 2,
  speed: 0.003 + rand() * 0.005,
  noiseOffsetX: rand() * 1000,
  noiseOffsetY: rand() * 1000,
}));

/**
 * Scene 1: Void (frames 0-120)
 * Pure atmosphere. Small particles drift through darkness.
 * No text, no UI. Establishes the cinematic tone.
 */
export const Void: React.FC = () => {
  const frame = useCurrentFrame();
  const time = frame * 0.02;

  return (
    <VoidBackground>
      {particles.map((p, i) => {
        const nx = noise2D(p.noiseOffsetX + time * p.speed * 30, 0);
        const ny = noise2D(0, p.noiseOffsetY + time * p.speed * 30);
        const x = p.baseX + (nx - 0.5) * 200;
        const y = p.baseY + (ny - 0.5) * 200;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: theme.ink,
              opacity: 0.18,
              transform: "translate(-50%, -50%)",
              filter: "blur(0.5px)",
            }}
          />
        );
      })}
    </VoidBackground>
  );
};
