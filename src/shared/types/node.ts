import type { NodeId, Timestamp, Title, Url, FaviconUrl, Tag } from "./ids"
import { now, urlToTitle } from "./ids";

// types

export interface TreeEntry {
    url: Url;
    title?: Title;
    favicon?: FaviconUrl;
}

export interface TreeNodeJSON {
    id: NodeId;
    url: Url;
    title: Title;
    favicon?: FaviconUrl;
    timestamp: Timestamp;

    pinned: boolean;
    tags: Tag[];
    collapsed: boolean;

    children: TreeNodeJSON[];
}
