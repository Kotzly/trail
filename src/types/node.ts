import type { NodeId, Timestamp, Title, Url, FaviconUrl, Tag } from "./ids"
import { urlToTitle } from "./factories";

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

let nodeIdCounter = 0 as NodeId;

export class TreeNode {
    readonly id: NodeId;

    url: Url;
    title: Title;
    favicon?: FaviconUrl;
    timestamp: Timestamp;

    parent?: TreeNode;
    children: TreeNode[];

    pinned: boolean;
    tags: Tag[];
    collapsed: boolean;

    constructor(
        id: NodeId,
        entry: TreeEntry,
        timestamp: Timestamp = Date.now() as Timestamp
    ) {
        this.id = id;
        
        this.url = entry.url;
        this.title = entry.title ?? urlToTitle(entry.url);
        if (entry.favicon) {
            this.favicon = entry.favicon;
        }
        this.timestamp = timestamp;
        this.children = [];
        this.parent = undefined as unknown as TreeNode;
        this.collapsed = false;
        this.pinned = false;
        this.tags = [];
    }


    addChild(id: NodeId, entry: TreeEntry, ts: Timestamp = Date.now() as Timestamp): TreeNode {
        const child = new TreeNode(id, entry, ts);
        child.parent = this;
        this.children.push(child);
        return child;
    }
}
