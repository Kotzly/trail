import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, fonts } from "../theme";

interface TrackedTextProps {
  text: string;
  /** Frame at which the text begins appearing (relative to Sequence) */
  enterFrame?: number;
  fontSize?: number;
  color?: string;
  letterSpacing?: string;
  /** If provided, fades out starting at this frame (relative to Sequence) */
  exitFrame?: number;
}

/**
 * Display text in Syne, uppercase, with generous letter-spacing.
 * Fades in word-by-word with staggered animations.
 * Internal timing uses fps-based durations per Remotion best practices.
 */
export const TrackedText: React.FC<TrackedTextProps> = ({
  text,
  enterFrame = 0,
  fontSize = 32,
  color = theme.ink,
  letterSpacing = "0.2em",
  exitFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - enterFrame;

  if (localFrame < -5) return null;

  const words = text.split(" ");

  // Timing in seconds * fps for readability
  const wordStaggerFrames = Math.round(0.12 * fps); // 0.12s between each word
  const wordFadeInFrames = Math.round(0.3 * fps); // 0.3s per word fade-in
  const wordSlideFrames = Math.round(0.3 * fps); // 0.3s per word slide
  const exitFadeFrames = Math.round(0.5 * fps); // 0.5s exit fade

  const exitOpacity = exitFrame !== undefined
    ? interpolate(frame, [exitFrame, exitFrame + exitFadeFrames], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  return (
    <div
      style={{
        display: "flex",
        gap: fontSize * 0.35,
        justifyContent: "center",
        opacity: exitOpacity,
      }}
    >
      {words.map((word, i) => {
        const wordDelay = i * wordStaggerFrames;
        const wordFrame = localFrame - wordDelay;

        const wordOpacity = interpolate(wordFrame, [0, wordFadeInFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const wordY = interpolate(wordFrame, [0, wordSlideFrames], [12, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <span
            key={i}
            style={{
              fontFamily: fonts.display,
              fontSize,
              fontWeight: 700,
              color,
              letterSpacing,
              textTransform: "uppercase",
              opacity: wordOpacity,
              transform: `translateY(${wordY}px)`,
              display: "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
