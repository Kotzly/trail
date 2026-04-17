/**
 * Motion feature-flag catalog.
 *
 * Every animation in the graph is individually toggleable through
 * PostHog so we can kill-switch a bad animation without shipping a new
 * extension build (store review takes days). See `MotionFlagsProvider`
 * for the refresh strategy and `useMotionFlag` for the consumer API.
 *
 * Keys use snake_case with a `<category>_<effect>` layout — PostHog
 * only accepts `[A-Za-z0-9_-]`, so no dots. Categories are informal;
 * they only exist to make the PostHog dashboard scannable.
 *
 * Defaults below are the safe baseline: ambient layer is OFF,
 * functional animations are ON, speculative effects (active pulse,
 * breadcrumb) are OFF until a signal says otherwise.
 */

export type MotionFlagKey =
  // Micro-interactions
  | "hover_node_highlight"
  | "hover_edge_highlight"
  | "click_select_dim"
  // Lifecycle
  | "lifecycle_node_enter"
  | "lifecycle_edge_draw"
  | "lifecycle_active_pulse"
  | "lifecycle_node_exit"
  | "lifecycle_relayout"
  // Ambient (OFF by default — see §3 of plan)
  | "ambient_brownian"
  | "ambient_autopan"
  | "ambient_edge_wave"
  | "ambient_breathing"
  // Event reactions
  | "event_flash_on_return"
  | "event_edge_particle"
  | "event_camera_lead"
  // Camera
  | "camera_smooth_center"
  | "camera_fit_to_view"
  | "camera_focus_mode"
  | "camera_breadcrumb"
  // Clusters
  | "cluster_collapse"
  | "cluster_hover_highlight"
  // State feedback
  | "state_shimmer"
  | "state_error_wiggle"
  | "state_search_fade"
  | "state_filter_fade";

export type MotionConfig = Readonly<Record<MotionFlagKey, boolean>>;

export const DEFAULT_MOTION_CONFIG: MotionConfig = Object.freeze({
  hover_node_highlight: true,
  hover_edge_highlight: true,
  click_select_dim: true,

  lifecycle_node_enter: true,
  lifecycle_edge_draw: true,
  lifecycle_active_pulse: false,
  lifecycle_node_exit: true,
  lifecycle_relayout: true,

  ambient_brownian: false,
  ambient_autopan: false,
  ambient_edge_wave: false,
  ambient_breathing: false,

  event_flash_on_return: true,
  event_edge_particle: false,
  event_camera_lead: false,

  camera_smooth_center: true,
  camera_fit_to_view: true,
  camera_focus_mode: true,
  camera_breadcrumb: false,

  cluster_collapse: true,
  cluster_hover_highlight: true,

  state_shimmer: true,
  state_error_wiggle: true,
  state_search_fade: true,
  state_filter_fade: true,
});

export const MOTION_FLAG_KEYS: readonly MotionFlagKey[] = Object.freeze(
  Object.keys(DEFAULT_MOTION_CONFIG) as MotionFlagKey[],
);

/**
 * Merge a partial PostHog snapshot with compile-time defaults.
 * Missing keys are filled from defaults, never coerced to `false`.
 */
export function mergeMotionSnapshot(remote: Readonly<Record<string, boolean>>): MotionConfig {
  const next = { ...DEFAULT_MOTION_CONFIG } as Record<MotionFlagKey, boolean>;
  for (const key of MOTION_FLAG_KEYS) {
    if (key in remote) next[key] = remote[key]!;
  }
  return next;
}

export function motionConfigEqual(a: MotionConfig, b: MotionConfig): boolean {
  for (const key of MOTION_FLAG_KEYS) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
