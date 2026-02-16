import { interpolate, useCurrentFrame } from "remotion";
import { VoidBackground } from "../components/VoidBackground";
import { TrailLogo } from "../components/TrailLogo";
import { TrackedText } from "../components/TrackedText";
import { theme, fonts } from "../theme";
import { seededRandom, noise2D } from "../lib/noise";

const rand = seededRandom(808);

const ambientParticles = Array.from({ length: 30 }, () => ({
  baseX: rand() * 1920,
  baseY: rand() * 1080,
  size: 1.2 + rand() * 1.5,
  noiseOff: rand() * 500,
}));

/**
 * Scene 7: Close (frames 0-240 local, 1560-1800 globally)
 * Trail logo, CTA, ambient particles, fade to void.
 */
export const Close: React.FC = () => {
  const frame = useCurrentFrame();
  const time = frame * 0.015;

  const fadeOut = interpolate(frame, [200, 240], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const urlGlow = Math.sin(frame * 0.08) * 0.3 + 0.7;

  return (
    <VoidBackground>
      {/* Ambient particles */}
      {ambientParticles.map((p, i) => {
        const nx = noise2D(p.noiseOff + time * 8, 0);
        const ny = noise2D(0, p.noiseOff + time * 8);
        const x = p.baseX + (nx - 0.5) * 100;
        const y = p.baseY + (ny - 0.5) * 100;
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
              opacity: 0.08 * fadeOut,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}

      <div style={{ opacity: fadeOut }}>
        {/* Logo */}
        <TrailLogo
          enterFrame={10}
          drawDuration={40}
          size={120}
          cx={960}
          cy={400}
        />

        {/* MAP YOUR BROWSING. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 500,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <TrackedText
            text="MAP YOUR BROWSING."
            enterFrame={60}
            fontSize={44}
            letterSpacing="0.15em"
          />
        </div>

        {/* gettrail.net */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 570,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {frame >= 75 && (
            <span
              style={{
                fontFamily: fonts.mono,
                fontSize: 20,
                color: theme.amber,
                letterSpacing: "0.04em",
                opacity: interpolate(frame, [75, 90], [0, 1], {
                  extrapolateRight: "clamp",
                }) * urlGlow,
                textShadow: `0 0 20px ${theme.amber}40`,
              }}
            >
              gettrail.net
            </span>
          )}
        </div>
      </div>
    </VoidBackground>
  );
};
