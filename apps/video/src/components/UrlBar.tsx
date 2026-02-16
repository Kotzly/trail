import { interpolate, useCurrentFrame } from "remotion";
import { theme, fonts } from "../theme";

interface UrlBarProps {
  /** Array of URLs to cycle through */
  urls: string[];
  /** Frames per URL (how long each stays visible) */
  framesPerUrl?: number;
  /** Frame offset for when this component starts */
  enterFrame?: number;
  /** Y position of the bar */
  y?: number;
}

/**
 * A minimal dark browser URL bar with a typing animation.
 * Cycles through provided URLs at the specified rate.
 */
export const UrlBar: React.FC<UrlBarProps> = ({
  urls,
  framesPerUrl = 75,
  enterFrame = 0,
  y = 80,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - enterFrame;
  if (localFrame < 0) return null;

  const barOpacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  const currentUrlIndex = Math.min(
    Math.floor(localFrame / framesPerUrl),
    urls.length - 1,
  );
  const frameInUrl = localFrame - currentUrlIndex * framesPerUrl;

  const currentUrl = urls[currentUrlIndex];
  const typingDuration = 20;
  const charsVisible = Math.min(
    Math.floor(
      interpolate(frameInUrl, [0, typingDuration], [0, currentUrl.length], {
        extrapolateRight: "clamp",
      }),
    ),
    currentUrl.length,
  );

  const displayedUrl = currentUrl.slice(0, charsVisible);
  const showCursor = frameInUrl < typingDuration + 10;

  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: "50%",
        transform: "translateX(-50%)",
        opacity: barOpacity,
        zIndex: 10,
      }}
    >
      <div
        style={{
          backgroundColor: theme.surface,
          borderRadius: 12,
          border: `1px solid ${theme.edgeLine}`,
          padding: "12px 24px",
          minWidth: 560,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Dot triplet */}
        <div style={{ display: "flex", gap: 5 }}>
          {[theme.edgeLine, theme.edgeLine, theme.edgeLine].map((c, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: c,
                opacity: 0.6,
              }}
            />
          ))}
        </div>
        {/* URL text */}
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 14,
            color: theme.inkMuted,
            letterSpacing: "0.01em",
          }}
        >
          {displayedUrl}
          {showCursor && (
            <span
              style={{
                color: theme.amber,
                opacity: Math.sin(localFrame * 0.3) > 0 ? 1 : 0,
              }}
            >
              |
            </span>
          )}
        </span>
      </div>
    </div>
  );
};
