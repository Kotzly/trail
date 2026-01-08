import { NodeId } from "./ids";
import { TreeNodeJSON } from "./node";

export type NavigationOptions = {
    backOnRevisit?: boolean;
}

export const DefaultNavigationOptions: NavigationOptions = {
    backOnRevisit: true,
} as const;

export interface NavigationTreeJSON {
    root: TreeNodeJSON | null;
    currentNodeId: NodeId | null;
    capacity: number;
    nodeCount: number;
}
