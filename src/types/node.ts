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
    url: Url;
    title: Title;
    favicon?: FaviconUrl;
    timestamp: Timestamp;

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
    readonly url: Url;
    readonly timestamp: Timestamp;

    title: Title;
    favicon?: FaviconUrl;

    pinned: boolean;
    tags: Tag[];
    collapsed: boolean;

    parent: TreeNode | null;
    children: TreeNode[];

    constructor(
        entry: TreeEntry,
    ) {
        this.id = nextNodeId();
        this.url = entry.url;
        this.timestamp = now();

        this.title = entry.title ?? urlToTitle(entry.url);
        if (entry.favicon !== undefined) {
            this.favicon = entry.favicon;
        }

        this.parent = null;
        this.children = [];
        
        this.pinned = false;
        this.collapsed = false;
        this.tags = [];
    }


    addChild(entry: TreeEntry): TreeNode {
        const child = new TreeNode(entry);
        child.parent = this;
        this.children.push(child);
        return child;
    }
}
