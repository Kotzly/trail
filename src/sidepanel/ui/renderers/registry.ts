import type { NodeId } from "../../../shared/types/ids";
import type { TreeNode } from "../../../background/state/treenode";
import type { NavigationTree } from "../../../background/state/tree-store";


const RENDERERS: Record<ModeId, RenderFunc> = {};

export type ModeId = string;


export type RendererOptions = {
    onNavigate: (node: TreeNode) => void;
    openNodeIds?: Set<NodeId> | null;
    tabStates?: Record<NodeId, TabState>;
    nodeTabCounts?: Record<NodeId, number>;
}

export type TabState = {
    muted?: boolean;
    audible?: boolean;
}

export type RenderFunc = (treeData: NavigationTree, container: HTMLElement, options: RendererOptions) => NodeId | null;

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
