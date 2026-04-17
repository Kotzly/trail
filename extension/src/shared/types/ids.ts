/**
 * Namespaced brand helper. Uses a computed key `__brand_<B>` so
 * independent brands can intersect without colliding on `__brand`
 * (previous implementation used a single literal key, which made
 * `Brand<X, "A"> & Brand<X, "B">` reduce to `never`). Now
 * `UUIDv7 & NodeId` is a valid intersection with both brand flags.
 */
export type Brand<T, B extends string> = T & { readonly [K in `__brand_${B}`]: true };

// export type WindowId = Brand<number, "WindowId">;
export type TabId = Brand<number, "TabId">;

/**
 * A string matching the RFC 9562 uuidv7 shape. The compile-time brand
 * doesn't enforce the shape (TypeScript can't constrain it); the
 * runtime guarantee comes from {@link uuidv7} being the only path
 * that mints values of this type. Validate untrusted input via
 * {@link isUUIDv7}.
 */
export type UUIDv7 = Brand<string, "UUIDv7">;

/**
 * Regex for the uuidv7 shape: 8-4-4-4-12 hex with version nibble
 * fixed at 7 and variant high-bits 10xx (digit range 8-b).
 */
export const UUIDv7_RE: RegExp =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUUIDv7(value: unknown): value is UUIDv7 {
  return typeof value === "string" && UUIDv7_RE.test(value);
}

/**
 * Node IDs are uuidv7 strings — exclusively. Every TreeNode gets
 * minted via `uuidv7()` from @shared/lib/uuid.ts. Schema v2 migration
 * re-mints any pre-v2 numeric ids to fresh uuidv7s (see
 * src/background/services/migrations.ts). The type is the
 * intersection of `UUIDv7` (shape) and a nominal `NodeId` brand
 * (distinct from other UUIDv7-typed ids that may be added later).
 */
export type NodeId = UUIDv7 & Brand<string, "NodeId">;

/**
 * Assert a uuidv7 string is destined for use as a NodeId. Cheap —
 * it's a cast; the runtime shape check happens at the mint site
 * (uuidv7) or at the migration boundary.
 */
export function asNodeId(id: UUIDv7): NodeId {
  return id as NodeId;
}

export type Timestamp = Brand<number, "time">;
export type Url = Brand<string, "Url">;
export type UrlWithTimestamp = Brand<{ url: Url; timestamp: Timestamp }, "UrlWithTimestamp">;
export type FaviconUrl = Brand<string, "FaviconUrl">;

export type Title = Brand<string, "Title">;

export type Tag = Brand<string, "Tag">;

export function now(): Timestamp {
  return Date.now() as Timestamp;
}

export function urlToTitle(url: Url): Title {
  return url as string as Title;
}

export type JSONString = Brand<string, "JSONString">;
export type Description = Brand<string, "Description">;
