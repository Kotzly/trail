/**
 * Trail export bundle format.
 *
 * Files use the `.trail.json` extension and contain minified JSON
 * (no whitespace) for size efficiency while remaining human-readable.
 */

import type { NavigationTreeJSON } from "./tree.js";

export type TrailExportBundle = {
  /** Schema version for forward compatibility. */
  schema: "trail.export.v1";
  /** Unix timestamp (ms) when the export was created. */
  exportedAt: number;
  /** Origin metadata. */
  source: {
    treeId?: string;
    treeLabel?: string;
    origin: "dashboard" | "extension";
  };
  /** Full tree in standard keyed JSON format (not compact). */
  tree: NavigationTreeJSON;
  /** Derived metadata. */
  meta: {
    nodeCount: number;
  };
};

export const EXPORT_SCHEMA = "trail.export.v1" as const;
