import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";

import { Void } from "./scenes/Void";
import { Chaos } from "./scenes/Chaos";
import { Emergence } from "./scenes/Emergence";
import { Capture } from "./scenes/Capture";
import { Metamorphosis } from "./scenes/Metamorphosis";
import { Converge } from "./scenes/Converge";
import { Close } from "./scenes/Close";

import { AmbientField } from "./components/AmbientField";
import { Vignette } from "./components/Vignette";
import { FilmGrain } from "./components/FilmGrain";
import { theme } from "./theme";

/**
 * Trail Demo Video - Main Composition
 *
 * Structure (30fps):
 *
 *   Scene 1: Void           120 frames (4s)
 *   -- fade transition       15 frames overlap
 *   Scene 2: Chaos          150 frames (5s)
 *   -- fade transition       15 frames overlap
 *   Scene 3: Emergence      270 frames (9s)
 *   -- fade transition       15 frames overlap
 *   Scene 4: Capture        360 frames (12s)
 *   -- fade transition       15 frames overlap
 *   Scene 5: Metamorphosis  360 frames (12s)
 *   -- fade transition       15 frames overlap
 *   Scene 6: Converge       300 frames (10s)
 *   -- fade transition       15 frames overlap
 *   Scene 7: Close          240 frames (8s)
 *
 *   Total: 1800 - 6×15 (fade overlaps) = 1710 frames (57s)
 *
 * Persistent layers (run full duration, behind/above all scenes):
 *   - AmbientField: particle field at zIndex 0
 *   - Vignette + FilmGrain: atmospheric overlays on top
 */
export const TrailDemo: React.FC = () => {
  const FADE_DURATION = 15;
  const PREMOUNT = 30; // 1 second at 30fps

  return (
    <AbsoluteFill style={{ backgroundColor: theme.void }}>
      {/* Persistent animated particle field - runs for entire composition */}
      <AmbientField />

      {/* Scene sequence with transitions */}
      <TransitionSeries>
        {/* Scene 1: Void */}
        <TransitionSeries.Sequence durationInFrames={120} premountFor={PREMOUNT}>
          <Void />
        </TransitionSeries.Sequence>

        {/* Fade: Void → Chaos */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DURATION })}
        />

        {/* Scene 2: Chaos */}
        <TransitionSeries.Sequence durationInFrames={150} premountFor={PREMOUNT}>
          <Chaos />
        </TransitionSeries.Sequence>

        {/* Fade: Chaos → Emergence */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DURATION })}
        />

        {/* Scene 3: Emergence */}
        <TransitionSeries.Sequence durationInFrames={270} premountFor={PREMOUNT}>
          <Emergence />
        </TransitionSeries.Sequence>

        {/* Fade: Emergence → Capture */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DURATION })}
        />

        {/* Scene 4: Capture */}
        <TransitionSeries.Sequence durationInFrames={360} premountFor={PREMOUNT}>
          <Capture />
        </TransitionSeries.Sequence>

        {/* Fade: Capture → Metamorphosis */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DURATION })}
        />

        {/* Scene 5: Metamorphosis */}
        <TransitionSeries.Sequence durationInFrames={360} premountFor={PREMOUNT}>
          <Metamorphosis />
        </TransitionSeries.Sequence>

        {/* Fade: Metamorphosis → Converge */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DURATION })}
        />

        {/* Scene 6: Converge */}
        <TransitionSeries.Sequence durationInFrames={300} premountFor={PREMOUNT}>
          <Converge />
        </TransitionSeries.Sequence>

        {/* Fade: Converge → Close */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: FADE_DURATION })}
        />

        {/* Scene 7: Close */}
        <TransitionSeries.Sequence durationInFrames={240} premountFor={PREMOUNT}>
          <Close />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Atmospheric overlays - always on top of everything */}
      <Vignette />
      <FilmGrain />
    </AbsoluteFill>
  );
};
