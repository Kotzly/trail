export type Brand<T, B extends string> = T & { readonly __brand: B};


export type TabId = Brand<number, "TabId">;;
export type NodeId = Brand<number, "NodeId">;
export type Timestamp = Brand<number, "time">;
export type Url = Brand<string, "Url">
export type FaviconUrl = Brand<string, "FaviconUrl">
export type Title = Brand<string, "Title">
export type Tag = Brand<string, "Tag">

export function now(): Timestamp {
    return Date.now() as Timestamp;
}