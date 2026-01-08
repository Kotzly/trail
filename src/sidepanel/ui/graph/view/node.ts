import type { NodeId } from '../../../../shared/types/ids';
import type { NodePosition } from '../types';
import { formatUrl, escapeHtml } from '../../shared/format';
import { getLayoutConfig } from '../layout/config';
import { GraphState } from '../state/graph-state';
import { TAG_PRESETS } from '../tags';
import { showContextMenu } from '../menus/context-menu';
import { NavigationNode } from '../../../../shared/types/node';

/**
 * Create a graph node element.
 */
export function createGraphNode(
  node: NavigationNode,
  position: NodePosition,
  currentId: NodeId | null,
  openNodeIds: Set<NodeId> | null = null,
  nodeTabCounts: Record<NodeId, number> = {}
): HTMLElement {
  const layoutConfig = getLayoutConfig();
  const currentTabStates = GraphState.getCurrentTabStates();
  const graphAPI = GraphState.getGraphAPI();
  
  const nodeEl = document.createElement('div');
  nodeEl.className = 'graph-node';
  nodeEl.dataset.nodeId = String(node.id);
  nodeEl.style.left = `${position.x}px`;
  nodeEl.style.top = `${position.y}px`;
  nodeEl.style.width = `${layoutConfig.nodeWidth}px`;
  nodeEl.style.height = `${layoutConfig.nodeHeight}px`;

  if (node.id === currentId) {
    nodeEl.classList.add('current');
  }
  
  // Mark as closed if in multi-tab mode and not open
  if (openNodeIds !== null && !openNodeIds.has(node.id)) {
    nodeEl.classList.add('closed');
  }
  
  // Get tab state for this node
  const tabState = currentTabStates[node.id];
  if (tabState?.sound.muted) {
    nodeEl.classList.add('muted');
  }
  
  // Pinned indicator - flat pin icon
  if (node.data.pinned) {
    nodeEl.classList.add('pinned');
    const pinIcon = document.createElement('div');
    pinIcon.className = 'graph-node-pin';
    pinIcon.title = 'Pinned';
    pinIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>';
    nodeEl.appendChild(pinIcon);
  }
  
  // Favicon
  const favicon = document.createElement('div');
  favicon.className = 'graph-node-favicon';
  if (node.data.favicon) {
    const img = document.createElement('img');
    img.src = node.data.favicon;
    img.alt = '';
    img.onerror = () => { favicon.innerHTML = '🌐'; };
    favicon.appendChild(img);
  } else {
    favicon.innerHTML = '🌐';
  }
  
  nodeEl.appendChild(favicon);
  
  const content = document.createElement('div');
  content.className = 'graph-node-content';
  content.innerHTML = `
    <div class="graph-node-title">${escapeHtml(node.data.title || 'Untitled')}</div>
    <div class="graph-node-url">${escapeHtml(formatUrl(node.data.url))}</div>
  `;
  nodeEl.appendChild(content);
  
  // Tab count badge (multiple tabs for same node in same window)
  // Add AFTER all other content so it's on top
  const tabCount = nodeTabCounts[node.id];
  if (tabCount && tabCount > 1) {
    const badge = document.createElement('div');
    badge.className = 'graph-node-tab-count';
    badge.textContent = `${tabCount}x`;
    badge.title = `${tabCount} tabs open for this page`;
    nodeEl.appendChild(badge);
  }

  // Tag dots
  if (node.data.tags && node.data.tags.length > 0) {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'graph-node-tags';
    node.data.tags.forEach(tagId => {
      const tagPreset = TAG_PRESETS.find(t => t.id === tagId);
      if (tagPreset) {
        const dot = document.createElement('span');
        dot.className = 'graph-node-tag-dot';
        dot.style.backgroundColor = tagPreset.color;
        dot.title = tagPreset.label;
        tagsContainer.appendChild(dot);
      }
    });
    nodeEl.appendChild(tagsContainer);
  }
  
  // Audio indicator for tabs playing sound
  if (tabState?.sound.audible) {
    const audioIcon = document.createElement('div');
    audioIcon.className = 'graph-node-audio';
    audioIcon.title = tabState.sound.muted ? 'Unmute tab' : 'Mute tab';
    audioIcon.innerHTML = tabState.sound.muted 
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
    audioIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: 'TOGGLE_MUTE', nodeId: node.id });
    });
    nodeEl.appendChild(audioIcon);
  }
  
  // Click to navigate or select
  nodeEl.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Shift+click to add/remove from selection
    if (e.shiftKey) {
      const currentSelected = GraphState.getSelectedNodeIds();
      if (currentSelected.has(node.id)) {
        currentSelected.delete(node.id);
        nodeEl.classList.remove('selected');
        GraphState.setSelectedNodeIds(new Set(currentSelected));
      } else {
        currentSelected.add(node.id);
        nodeEl.classList.add('selected');
        GraphState.setSelectedNodeIds(new Set(currentSelected));
      }
      return;
    }
    
    // Regular click: clear selection and center on node
    GraphState.setSelectedNodeIds(new Set());
    document.querySelectorAll('.graph-node.selected').forEach(el => {
      el.classList.remove('selected');
    });
    
    // Center on this node with smooth animation
    if (graphAPI && graphAPI.centerOnNode) {
      graphAPI.centerOnNode(node.id, true);
    }
  });
  
  // Right-click context menu
  nodeEl.addEventListener('contextmenu', (e) => {
    e.stopPropagation();
    showContextMenu(e, node);
  });
  
  return nodeEl;
}

/**
 * Draw connection line between parent and child (vertical layout).
 * Connection goes from bottom of parent to top of child.
 */
export function createConnection(
  parentPos: NodePosition,
  childPos: NodePosition,
  branchIndex: number = 0
): SVGPathElement {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.classList.add('graph-connection');
  path.classList.add(`branch-${(branchIndex % 5) + 1}`);
  const layoutConfig = getLayoutConfig();
  const { nodeWidth, nodeHeight } = layoutConfig;
  
  // Start from bottom center of parent
  const startX = parentPos.x + nodeWidth / 2;
  const startY = parentPos.y + nodeHeight;
  
  // End at top center of child
  const endX = childPos.x + nodeWidth / 2;
  const endY = childPos.y;
  
  // Bezier curve for smooth vertical connection
  const midY = (startY + endY) / 2;
  const d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
  
  path.setAttribute('d', d);
  
  return path;
}

/**
 * Draw all connections recursively.
 */
export function drawConnections(
  node: NavigationNode | null,
  positions: Map<number, NodePosition>,
  svg: SVGElement,
  pathNodeIds: Set<NodeId> | null = null
): void {
  if (!node || !node.getChildren()) return;
  
  const parentPos = positions.get(node.id);
  if (!parentPos) return;
  
  node.getChildren().forEach((child: NavigationNode, idx: number) => {
    const childPos = positions.get(child.id);
    if (childPos) {
      const connection = createConnection(parentPos, childPos, idx);
      
      // Highlight if both parent and child are on the path
      if (pathNodeIds && pathNodeIds.has(node.id) && pathNodeIds.has(child.id)) {
        connection.classList.add('on-path');
      }
      
      svg.appendChild(connection);
      drawConnections(child, positions, svg, pathNodeIds);
    }
  });
}

/**
 * Get path from root to a specific node within a given root.
 */
export function getPathToNode(root: NavigationNode, targetId: NodeId): Set<NodeId> {
  const path = new Set<NodeId>();
  
  function findPath(node: NavigationNode | null): boolean {
    if (!node) return false;
    
    path.add(node.id);
    
    if (node.id === targetId) return true;
    
    for (const child of node.getChildren()) {
      if (findPath(child)) return true;
    }
    
    path.delete(node.id);
    return false;
  }
  
  findPath(root);
  return path;
}


