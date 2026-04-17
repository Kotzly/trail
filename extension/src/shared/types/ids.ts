export type Brand<T, B extends string> = T & { readonly __brand: B };

// export type WindowId = Brand<number, "WindowId">;
export type TabId = Brand<number, "TabId">;
/**
 * Node IDs are uuidv7 strings — exclusively. Every TreeNode gets
 * minted via `uuidv7()` from @shared/lib/uuid.ts. The schema v2
 * migration re-mints any pre-v2 numeric ids to fresh uuidv7s
 * (see src/background/services/migrations.ts). Runtime code may
 * assume ids match the uuidv7 shape — there is no backward-compat
 * path for numeric ids.
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
