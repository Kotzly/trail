/**
 * Shared types for the observability module. Lives in its own file so
 * sub-modules can depend on it without pulling in the full
 * `observability.ts` (which transitively imports `wxt/utils/storage`).
 */

export type ObservabilitySurface = "sidepanel" | "settings" | "background" | "content" | "login";
