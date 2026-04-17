export type Brand<T, B extends string> = T & { readonly __brand: B };

// export type WindowId = Brand<number, "WindowId">;
export type TabId = Brand<number, "TabId">;
/**
 * Node IDs are uuidv7 strings (Phase 1 of tree-tracking overhaul).
 * Legacy persisted data is upgraded from numeric ids to String(id) via
 * the schema v2 migration. New nodes get a fresh uuidv7 from
 * @shared/lib/uuid.ts.
 */
export type NodeId = Brand<string, "NodeId">;

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
