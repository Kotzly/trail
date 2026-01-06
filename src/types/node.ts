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

    private parent?: TreeNode;
    private children: TreeNode[];

    pinned: boolean;
    tags: Tag[];
    collapsed: boolean;

    constructor(entry: TreeEntry) {
        this.id = ++nodeIdCounter as NodeId;
        
        this.url = entry.url;
        this.title = entry.title ?? urlToTitle(entry.url);
        if (entry.favicon) {
            this.favicon = entry.favicon;
        }
        this.timestamp = Date.now() as Timestamp;
        this.children = [];
        this.parent = undefined as unknown as TreeNode;
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

    marshalJSON(): TreeNodeJSON {
        return {
        id: this.id,
        url: this.url,
        title: this.title,
        favicon: this.favicon,
        timestamp: this.timestamp,
        collapsed: this.collapsed,
        pinned: this.pinned,
        tags: this.tags,
        children: this.children.map(c => c.marshalJSON())
        } as TreeNodeJSON;
    }

    static unmarshalJSON(json: TreeNodeJSON, parent: TreeNode | null = null): TreeNode {
        const node = new TreeNode({
        url: json.url,
        title: json.title,
        favicon: json.favicon,
        } as TreeEntry);
        
        (node as any).id = json.id;
        node.collapsed = json.collapsed;
        node.pinned = json.pinned;
        node.tags = json.tags as Tag[];
        if (parent) {
            node.parent = parent;
        }
        node.children = json.children.map(child => TreeNode.unmarshalJSON(child, node));
        
        // Update counter to avoid ID collisions
        if (json.id >= nodeIdCounter) {
            nodeIdCounter = json.id + 1 as NodeId;
        }
        
        return node;
    }
}
