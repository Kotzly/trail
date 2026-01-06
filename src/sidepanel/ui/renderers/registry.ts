import type { NodeId, Timestamp, Url, FaviconUrl } from "../../../shared/types/ids";
import type { TreeNode } from "../../../shared/types/node";


const RENDERERS: Record<ModeId, RenderFunc> = {};

export type ModeId = string;

export type TreeData = {
    root: TreeNode;
    currentNodeId?: NodeId;
}

export type RendererOptions = {
    onNavigate: (nodeId: NodeId) => void;
    openNodeIds: Set<NodeId>;
    compactGraph: boolean;
    tabStates?: Record<NodeId, TabState>;
    showOrphanTrees: boolean;
}

export type TabState = {
    muted?: boolean;
    audible?: boolean;
}

export type RenderFunc = (treeData: TreeData, container: HTMLElement, options: RendererOptions) => void;

export type Renderer = {
    modeId: ModeId;
    render: RenderFunc;
}


export function registerRenderer(modeId: ModeId, renderFn: RenderFunc) {
  RENDERERS[modeId] = renderFn;
}


export function getRenderer(modeId: ModeId): RenderFunc | undefined {
  return RENDERERS[modeId];
}

export function hasRenderer(modeId: ModeId): boolean {
  return modeId in RENDERERS;
}

export function getRegisteredRenderers(): ModeId[] {
  return Object.keys(RENDERERS);
}
