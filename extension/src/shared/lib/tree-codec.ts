/**
 * Tree codec: compact tuple format + gzip compression.
 *
 * Used for persisting stashed trees in browser.storage.local.
 * Active tree stays as plain NavigationTreeJSON for fast read/write.
 */

import { gzipSync, gunzipSync } from "fflate";
import { toCompact, fromCompact } from "./compact-mapper.js";
import type { NavigationTreeJSON } from "../types/tree.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Encode a tree into a compressed Uint8Array (compact JSON + gzip).
 */
export function encodeTree(tree: NavigationTreeJSON): Uint8Array {
  const compact = toCompact(tree);
  const json = JSON.stringify(compact);
  return gzipSync(encoder.encode(json));
}

/**
 * Decode a compressed Uint8Array back into NavigationTreeJSON.
 */
export function decodeTree(data: Uint8Array): NavigationTreeJSON {
  const json = decoder.decode(gunzipSync(data));
  return fromCompact(JSON.parse(json));
}
