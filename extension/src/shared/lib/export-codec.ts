/**
 * User-facing export/import codec.
 *
 * The on-disk file is gzipped compact JSON (the compact-tuple tree
 * format + export envelope) — typically ~10-20× smaller than the
 * pretty-printed JSON that preceded it, and a distinct `.trail`
 * extension so it can't be mistaken for a random JSON file.
 *
 * For maximum backward compatibility, the importer accepts **both**
 * the new gzip format and the legacy pretty-JSON format — the two are
 * distinguished by magic bytes (`0x1f 0x8b` for gzip) so a user who
 * has an older `trail-export-*.json` sitting in their downloads can
 * still import it after updating the extension.
 */

import { gzipSync, gunzipSync } from "fflate";
import { toCompact, fromCompact } from "./compact-mapper.js";
import type { CompactTreeJSON } from "../types/compact-tree.js";
import { EXPORT_SCHEMA, type TrailExportBundle } from "../types/export.js";
import type { NavigationTreeJSON } from "../types/tree.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const EXPORT_SCHEMA_V2 = "trail.export.v2" as const;

/**
 * Compact-on-wire envelope. `tree` is a {@link CompactTreeJSON} tuple
 * instead of a verbose keyed object; the gzip layer on top typically
 * takes the file to <10% of the legacy JSON size for real trees.
 */
type TrailExportEnvelopeV2 = {
  schema: typeof EXPORT_SCHEMA_V2;
  exportedAt: number;
  source: TrailExportBundle["source"];
  tree: CompactTreeJSON;
  meta: TrailExportBundle["meta"];
};

/**
 * Any shape the importer will accept. Kept loose so we can recognise
 * legacy JSON bundles, future v3 bundles, and garbage we reject with
 * a clear error.
 */
type UnknownBundle =
  | TrailExportBundle
  | TrailExportEnvelopeV2
  | { schema?: unknown; tree?: unknown; [k: string]: unknown };

function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function isV2Envelope(value: UnknownBundle): value is TrailExportEnvelopeV2 {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { schema?: unknown }).schema === EXPORT_SCHEMA_V2
  );
}

function isV1Bundle(value: UnknownBundle): value is TrailExportBundle {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { schema?: unknown }).schema === EXPORT_SCHEMA
  );
}

/**
 * Encode a tree bundle for download. Returns:
 *  - `bytes`: gzip binary (use with `new Blob([bytes])` and `.trail` extension)
 *  - `suggestedFilename`: `trail-export-<label>.trail`
 *  - `mimeType`: `application/octet-stream` (gzipped content is opaque binary)
 */
export function encodeExport(bundle: TrailExportBundle): {
  bytes: Uint8Array;
  suggestedFilename: string;
  mimeType: string;
} {
  const envelope: TrailExportEnvelopeV2 = {
    schema: EXPORT_SCHEMA_V2,
    exportedAt: bundle.exportedAt,
    source: bundle.source,
    tree: toCompact(bundle.tree),
    meta: bundle.meta,
  };
  const json = JSON.stringify(envelope);
  const bytes = gzipSync(encoder.encode(json));

  const safeLabel =
    (bundle.source.treeLabel ?? "tree")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "tree";

  return {
    bytes,
    suggestedFilename: `trail-export-${safeLabel}.trail`,
    mimeType: "application/octet-stream",
  };
}

/**
 * Decode a downloaded file (v2 gzip or v1 pretty JSON) back into the
 * in-memory {@link TrailExportBundle}. Throws with a user-readable
 * message if the file isn't something we recognise.
 */
export function decodeExport(bytes: Uint8Array): TrailExportBundle {
  let json: string;
  if (isGzip(bytes)) {
    try {
      json = decoder.decode(gunzipSync(bytes));
    } catch (err) {
      throw new Error("File looks like a .trail archive but couldn't be decompressed.", {
        cause: err,
      });
    }
  } else {
    json = decoder.decode(bytes);
  }

  let parsed: UnknownBundle;
  try {
    parsed = JSON.parse(json) as UnknownBundle;
  } catch (err) {
    throw new Error("File isn't a valid Trail export (invalid JSON).", { cause: err });
  }

  if (isV2Envelope(parsed)) {
    const tree = fromCompact(parsed.tree) as NavigationTreeJSON;
    return {
      schema: EXPORT_SCHEMA,
      exportedAt: parsed.exportedAt,
      source: parsed.source,
      tree,
      meta: parsed.meta,
    };
  }

  if (isV1Bundle(parsed)) {
    return parsed;
  }

  throw new Error(
    "File isn't a recognised Trail export. Expected a .trail archive or a legacy .json export.",
  );
}
