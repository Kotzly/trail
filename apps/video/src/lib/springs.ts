/**
 * Canonical spring configurations per Remotion best practices.
 */

/** Smooth, no bounce -- ideal for text reveals and fades */
export const SPRING_SMOOTH = {
  damping: 200,
} as const;

/** Snappy -- for UI elements appearing (nodes, cards, buttons) */
export const SPRING_SNAPPY = {
  damping: 20,
  stiffness: 200,
} as const;

/** Bouncy -- for playful entrances (share card, logo) */
export const SPRING_BOUNCY = {
  damping: 8,
} as const;
