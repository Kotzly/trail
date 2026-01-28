export type AnimationProgress = {
  progress: number;
  eased: number;
  pending: boolean;
  done: boolean;
};

export type AnimationSpec = {
  duration: number;
  stagger: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

export const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

export const getAnimationProgress = (
  now: number,
  startTime: number,
  duration: number,
): AnimationProgress => {
  const elapsed = now - startTime;
  if (elapsed < 0) {
    return { progress: 0, eased: 0, pending: true, done: false };
  }
  const safeDuration = duration <= 0 ? 1 : duration;
  const progress = clamp(elapsed / safeDuration, 0, 1);
  return {
    progress,
    eased: easeOutCubic(progress),
    pending: false,
    done: progress >= 1,
  };
};

export const createAnimationSpec = (duration: number, staggerRatio = 0.3): AnimationSpec => {
  const safeDuration = Math.max(1, Math.round(duration));
  return {
    duration: safeDuration,
    stagger: Math.round(safeDuration * staggerRatio),
  };
};
