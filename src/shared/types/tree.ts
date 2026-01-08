import { NodeId } from "./ids";
import { NavigationNodeJSON, TreeNodeJSON } from "./node";

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
