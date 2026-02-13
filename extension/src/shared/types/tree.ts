import { NodeId, Url, Title, FaviconUrl } from "./ids.js";
import { NavigationNodeJSON, TreeNodeJSON } from "./node.js";

export type NavigationOptions = {
    backOnRevisit?: boolean;
}

export const DefaultNavigationOptions: NavigationOptions = {
    backOnRevisit: true,
} as const;

export interface NavigationTreeJSON {
    root: NavigationNodeJSON | null;
    currentNodeId: NodeId | null;
    nodeCount: number;
}

export type TreeLabelSource = 'user' | 'auto' | 'system';

export type TreeMeta = {
    id: string;
    label: string;
    labelSource: TreeLabelSource;
    labelUpdatedAt: number;
    createdAt: number;
};

export type TreeSummary = TreeMeta & {
    nodeCount: number;
    savedAt: number;
    rootUrl?: Url;
    rootTitle?: Title;
    rootFavicon?: FaviconUrl;
};

export type TreeRecord = TreeSummary & {
    tree: NavigationTreeJSON;
};
