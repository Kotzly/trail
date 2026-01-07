

import { NodeId, Timestamp, Title, Url, FaviconUrl, Tag } from "../../shared/types/ids";
import { TreeEntry } from "../../shared/types/node";
import { now, urlToTitle } from "../../shared/types/ids";

let nodeIdCounter = 0 as NodeId;

function nextNodeId(): NodeId {
    return (++nodeIdCounter) as NodeId;
}

// class

export class TreeNode {
    readonly id: NodeId;
    readonly url: Url;
    timestamp: Timestamp;

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

    updateMetadata(entry: TreeEntry) {
        if (entry.title !== undefined) this.title = entry.title;
        if (entry.favicon !== undefined) this.favicon = entry.favicon;
        this.timestamp = now();
    }
}
