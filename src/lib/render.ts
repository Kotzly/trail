import { NodeId, Timestamp, Url, FaviconUrl } from "../types/ids";
import { TreeNode } from "../types/node";


const RENDERERS: Record<ModeId, RenderFunc> = {};

export type ModeId = string;
export type TreeData = {
    root: TreeNode;
    children: TreeNode[];
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

export function formatTime(timestamp: Timestamp): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return new Date(timestamp).toLocaleDateString();
}

export function formatUrl(url: Url): string {
  try {
    const urlObj = new URL(url);
    let display = urlObj.hostname;
    if (urlObj.pathname !== '/') display += urlObj.pathname;
    if (urlObj.hash) display += urlObj.hash;
    return display;
  } catch {
    return url;
  }
}

export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function createFaviconElement(faviconUrl: FaviconUrl): HTMLElement {
  const container = document.createElement('div');
  container.className = 'entry-icon';
  
  if (faviconUrl) {
    const img = document.createElement('img');
    img.src = faviconUrl;
    img.alt = '';
    img.onerror = () => {
      container.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v8M8 12h8"/>
        </svg>
      `;
    };
    container.appendChild(img);
  } else {
    container.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v8M8 12h8"/>
      </svg>
    `;
  }
  
  return container;
}
