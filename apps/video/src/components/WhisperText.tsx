import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, fonts } from "../theme";

interface WhisperTextProps {
  text: string;
  enterFrame?: number;
  exitFrame?: number;
  fontSize?: number;
  color?: string;
}

/**
 * Narrative text in Cormorant italic.
 * Fades in word-by-word with gentle stagger -- the "human" voice of the video.
 * Internal timing uses fps-based durations per Remotion best practices.
 */
export const WhisperText: React.FC<WhisperTextProps> = ({
  text,
  enterFrame = 0,
  exitFrame,
  fontSize = 42,
  color = theme.inkMuted,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - enterFrame;
  if (localFrame < -5) return null;

  const words = text.split(" ");

  // Timing in seconds * fps for readability
  const wordStaggerFrames = Math.round(0.15 * fps); // 0.15s between words
  const wordFadeInFrames = Math.round(0.4 * fps); // 0.4s per word fade-in
  const exitFadeFrames = Math.round(0.65 * fps); // 0.65s exit fade

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
        gap: fontSize * 0.28,
        justifyContent: "center",
        flexWrap: "wrap",
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

        return (
          <span
            key={i}
            style={{
              fontFamily: fonts.narrative,
              fontSize,
              fontStyle: "italic",
              fontWeight: 400,
              color,
              opacity: wordOpacity,
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
