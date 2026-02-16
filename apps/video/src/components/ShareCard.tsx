import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, fonts } from "../theme";
import { SPRING_BOUNCY } from "../lib/springs";

interface ShareCardProps {
  enterFrame?: number;
  cx?: number;
  cy?: number;
}

/**
 * The share link preview card that the graph collapses into.
 * Springs in with a satisfying scale animation.
 */
export const ShareCard: React.FC<ShareCardProps> = ({
  enterFrame = 0,
  cx = 960,
  cy = 480,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - enterFrame;
  if (localFrame < 0) return null;

  const scale = spring({
    frame: localFrame,
    fps,
    config: SPRING_BOUNCY,
    from: 0.7,
    to: 1,
  });

  const opacity = interpolate(localFrame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  const cardWidth = 440;
  const cardHeight = 160;

  return (
    <div
      style={{
        position: "absolute",
        left: cx - cardWidth / 2,
        top: cy - cardHeight / 2,
        width: cardWidth,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "center",
      }}
    >
      <div
        style={{
          backgroundColor: theme.surface,
          borderRadius: 16,
          border: `1px solid ${theme.edgeLine}`,
          padding: "28px 32px",
          boxShadow: `0 0 40px ${theme.amber}15, 0 20px 60px rgba(0,0,0,0.4)`,
        }}
      >
        {/* Trail icon + title row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          {/* Mini trail icon */}
          <svg
            viewBox="0 0 128 128"
            width={24}
            height={24}
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M28.13,32.94c14.54,1.86,18.42,8.36,23.83,17.32s-11.6,11.44-5.43,24.84"
              fill="none"
              stroke={theme.amber}
              strokeLinecap="round"
              strokeWidth={4}
            />
            <path
              d="M75.13,62.06c-3.27-14.97-15.03,0-23.17-11.8"
              fill="none"
              stroke={theme.amber}
              strokeLinecap="round"
              strokeWidth={4}
            />
            <circle cx={28.13} cy={32.94} r={5} fill={theme.ink} />
            <circle cx={51.96} cy={50.26} r={5} fill={theme.ink} />
            <circle cx={75.13} cy={62.06} r={5} fill={theme.ink} />
          </svg>
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: 18,
              fontWeight: 700,
              color: theme.ink,
              letterSpacing: "0.04em",
            }}
          >
            Q4 Competitive Analysis
          </span>
        </div>
        {/* Subtitle */}
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 13,
            color: theme.inkMuted,
            marginBottom: 14,
          }}
        >
          12 sources &middot; 4 branches &middot; 3 notes
        </div>
        {/* Share link */}
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: 14,
            color: theme.amber,
            letterSpacing: "0.02em",
          }}
        >
          trail.link/research-q4
        </div>
      </div>
    </div>
  );
};
