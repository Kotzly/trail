import { type NodeId, type Timestamp, type Title, type Url, type FaviconUrl, type Tag, now } from "./ids"
import { urlToTitle } from "./factories";

// types

export interface TreeEntry {
    url: Url;
    title?: Title;
    favicon?: FaviconUrl;
}

export interface TreeNodeJSON {
    id: NodeId;
    readonly url: Url;
    readonly title: Title;
    favicon?: FaviconUrl;
    readonly timestamp: Timestamp;

    pinned: boolean;
    tags: Tag[];
    collapsed: boolean;

    children: TreeNodeJSON[];
}

// helpers

let nodeIdCounter = 0 as NodeId;

function nextNodeId(): NodeId {
    return (++nodeIdCounter) as NodeId;
}

// class

export class TreeNode {
    readonly id: NodeId;

    url: Url;
    title: Title;
    favicon?: FaviconUrl;
    timestamp: Timestamp;

    parent: TreeNode | null;
    children: TreeNode[];

    pinned: boolean;
    tags: Tag[];
    collapsed: boolean;

    constructor(
        entry: TreeEntry,
    ) {
        this.id = nextNodeId();
        
        this.url = entry.url;
        this.title = entry.title ?? urlToTitle(entry.url);
        if (entry.favicon) {
            this.favicon = entry.favicon;
        }
        this.timestamp = now();
        this.children = [];
        this.parent = null;
        this.collapsed = false;
        this.pinned = false;
        this.tags = [];
    }


    addChild(entry: TreeEntry): TreeNode {
        const child = new TreeNode(entry);
        child.parent = this;
        this.children.push(child);
        return child;
    }
}
