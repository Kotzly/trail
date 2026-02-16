import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D, seededRandom } from "../lib/noise";
import { theme } from "../theme";

const PARTICLE_COUNT = 80;

interface Particle {
  baseX: number;
  baseY: number;
  size: number;
  noiseOffsetX: number;
  noiseOffsetY: number;
  speed: number;
  opacity: number;
}

function generateParticles(seed: number): Particle[] {
  const rng = seededRandom(seed);
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      baseX: rng() * 1920,
      baseY: rng() * 1080,
      size: 1 + rng() * 2.5,
      noiseOffsetX: rng() * 1000,
      noiseOffsetY: rng() * 1000,
      speed: 0.3 + rng() * 0.7,
      opacity: 0.08 + rng() * 0.18,
    });
  }
  return particles;
}

const particles = generateParticles(42);

/**
 * Persistent animated particle field that runs for the entire composition.
 * Sits behind all scenes at zIndex: 0, never resets between scene cuts.
 *
 * Particle behavior varies by composition phase:
 *  - Void (0-4s): Slow, calm drift
 *  - Chaos (4-9s): Fast, erratic movement
 *  - Middle scenes (9-52s): Moderate, steady flow
 *  - Close (52-60s): Gentle settle
 */
export const AmbientField: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const time = frame / fps;

  // Phase-dependent energy multiplier
  const energy = getEnergy(time);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        {particles.map((p, i) => {
          const noiseTime = frame * 0.008 * p.speed * energy;

          const nx = noise2D(
            p.noiseOffsetX + noiseTime,
            p.noiseOffsetY
          );
          const ny = noise2D(
            p.noiseOffsetX,
            p.noiseOffsetY + noiseTime
          );

          // Drift range scales with energy
          const driftRange = 120 * energy;
          const x = p.baseX + (nx - 0.5) * driftRange;
          const y = p.baseY + (ny - 0.5) * driftRange;

          // Wrap around edges
          const wx = ((x % 1920) + 1920) % 1920;
          const wy = ((y % 1080) + 1080) % 1080;

          // Pulsing opacity tied to noise
          const pulseNoise = noise2D(
            p.noiseOffsetX + frame * 0.015,
            p.noiseOffsetY + frame * 0.015
          );
          const opacity = p.opacity * (0.5 + pulseNoise * 0.5) * Math.min(energy + 0.3, 1);

          // Subtle amber tint during high-energy phases
          const isAmber = energy > 1.2 && i % 5 === 0;
          const color = isAmber ? theme.amber : theme.ink;

          return (
            <circle
              key={i}
              cx={wx}
              cy={wy}
              r={p.size * (0.8 + energy * 0.2)}
              fill={color}
              opacity={opacity}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/**
 * Returns an energy multiplier based on the current time in the composition.
 * Controls how fast and far particles move.
 */
function getEnergy(timeInSeconds: number): number {
  if (timeInSeconds < 4) {
    // Void: calm
    return 0.4;
  } else if (timeInSeconds < 9) {
    // Chaos: frantic
    const t = (timeInSeconds - 4) / 5;
    return 0.4 + t * 1.6; // ramps from 0.4 to 2.0
  } else if (timeInSeconds < 18) {
    // Emergence: settling from chaos
    const t = (timeInSeconds - 9) / 9;
    return 2.0 - t * 1.0; // settles from 2.0 to 1.0
  } else if (timeInSeconds < 42) {
    // Capture + Metamorphosis: steady
    return 1.0;
  } else if (timeInSeconds < 52) {
    // Converge: calming
    const t = (timeInSeconds - 42) / 10;
    return 1.0 - t * 0.3; // 1.0 to 0.7
  } else {
    // Close: gentle
    return 0.5;
  }
}
