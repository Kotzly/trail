import { NodeId } from "./ids.js";
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
    capacity: number;
    nodeCount: number;
}
