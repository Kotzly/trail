/**
 * Capability tags reported by the extension to the marketing page via
 * the `site/ping` reply. New features that the page must branch on add
 * an entry here. The page uses presence to decide whether to expose
 * feature-tied UI (e.g. the "Import to my Trail" button on /s/<code>).
 *
 * Capabilities are append-only — never rename or remove entries, since
 * old extensions in the wild reply with the older list and the page
 * still needs to match against the historical names.
 */
export const BRIDGE_CAPABILITIES: readonly string[] = ["share_import"] as const;
