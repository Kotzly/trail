import { NodeId } from "./ids";
import { TreeNodeJSON } from "./node";

export type NavigationOptions = {
    backOnRevisit?: boolean;
}

export interface NavigationTreeJSON {
    root: TreeNodeJSON | null;
    currentNodeId: NodeId | null;
    capacity: number;
    nodeCount: number;
}
