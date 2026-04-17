const MARKETING_ORIGIN = "https://gettrail.net";

export const MARKETING_URLS = {
  homepage: MARKETING_ORIGIN,
  privacy: `${MARKETING_ORIGIN}/privacy`,
  terms: `${MARKETING_ORIGIN}/terms`,
  changelog: `${MARKETING_ORIGIN}/changelog`,
  support: `${MARKETING_ORIGIN}/support`,
  feedbackApi: `${MARKETING_ORIGIN}/api/feedback`,
} as const;

export function openExternal(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
