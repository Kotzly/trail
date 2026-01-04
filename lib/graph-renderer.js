/**
 * Graph View Renderer - interactive canvas with draggable nodes.
 * Features: pan, smooth zoom centered on cursor, vertical tree layout.
 */

import { VIEW_MODE } from './view-modes.js';
import { 
  registerRenderer, 
  formatTime, 
  formatUrl, 
  escapeHtml 
} from './renderers.js';

// Layout constants - VERTICAL orientation (top to bottom)
// Normal mode
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const VERTICAL_GAP = 60;   // Gap between parent and children (Y direction)
const HORIZONTAL_GAP = 24; // Gap between sibling nodes (X direction)
const ROOT_GAP = 60;       // Gap between separate trees (forest)
const PADDING = 40;

// Compact mode - smaller nodes with tighter spacing
const COMPACT_NODE_WIDTH = 100;
const COMPACT_NODE_HEIGHT = 40;
const COMPACT_VERTICAL_GAP = 40;
const COMPACT_HORIZONTAL_GAP = 12;
const COMPACT_ROOT_GAP = 40;

// Current layout config (set by render based on compactGraph setting)
let layoutConfig = {
  nodeWidth: NODE_WIDTH,
  nodeHeight: NODE_HEIGHT,
  verticalGap: VERTICAL_GAP,
  horizontalGap: HORIZONTAL_GAP,
  rootGap: ROOT_GAP,
  compact: false
};

// Graph API for external control (centering, etc.)
let graphAPI = null;

// Preserve view state across re-renders
let savedViewState = null;

/**
 * Calculate positions for all nodes in a single tree.
 * Vertical layout: root at top, children below, spreading horizontally.
 * Uses proper subtree width calculation to avoid overlapping.
 * @param {object} root - Root node
 * @param {number} startX - Starting X position for this tree
 * @returns {{ positions: Map<number, {x: number, y: number, node: object}>, width: number }}
 */
function calculateTreeLayout(root, startX = PADDING) {
  const positions = new Map();
  const subtreeWidths = new Map();
  const { nodeWidth, nodeHeight, verticalGap, horizontalGap } = layoutConfig;
  
  // First pass: calculate subtree widths (bottom-up)
  function calcWidths(node) {
    if (!node) return 0;
    if (!node.children || node.children.length === 0) {
      subtreeWidths.set(node.id, nodeWidth);
      return nodeWidth;
    }
    
    let totalWidth = 0;
    node.children.forEach((child, idx) => {
      totalWidth += calcWidths(child);
      if (idx < node.children.length - 1) {
        totalWidth += horizontalGap;
      }
    });
    
    const width = Math.max(nodeWidth, totalWidth);
    subtreeWidths.set(node.id, width);
    return width;
  }
  
  const treeWidth = calcWidths(root);
  
  // Second pass: assign positions (top-down)
  function layoutNode(node, x, y) {
    if (!node) return;
    
    const subtreeWidth = subtreeWidths.get(node.id) || nodeWidth;
    
    // Center this node within its subtree width
    const nodeX = x + (subtreeWidth - nodeWidth) / 2;
    positions.set(node.id, { x: nodeX, y, node });
    
    if (!node.children || node.children.length === 0) {
      return;
    }
    
    // Position children below
    const childY = y + nodeHeight + verticalGap;
    let childX = x;
    
    node.children.forEach((child) => {
      const childWidth = subtreeWidths.get(child.id) || nodeWidth;
      layoutNode(child, childX, childY);
      childX += childWidth + horizontalGap;
    });
  }
  
  layoutNode(root, startX, PADDING);
  
  return { positions, width: treeWidth };
}

/**
 * Calculate positions for a forest (multiple root trees).
 * Trees are arranged horizontally, left to right.
 * @param {Array} roots - Array of root nodes
 * @returns {Map<number, {x: number, y: number, node: object}>}
 */
function calculateForestLayout(roots) {
  const allPositions = new Map();
  let currentX = PADDING;
  
  roots.forEach((root) => {
    const { positions, width } = calculateTreeLayout(root, currentX);
    
    // Merge positions into allPositions
    positions.forEach((pos, id) => {
      allPositions.set(id, pos);
    });
    
    // Move X for next tree
    currentX += width + layoutConfig.rootGap;
  });
  
  return allPositions;
}

/**
 * Calculate positions for all nodes in the tree (legacy single-root).
 * @param {object} root - Root node
 * @returns {Map<number, {x: number, y: number, node: object}>}
 */
function calculateLayout(root) {
  const { positions } = calculateTreeLayout(root, PADDING);
  return positions;
}

/**
 * Get canvas bounds from positions.
 */
function getCanvasBounds(positions) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const { nodeWidth, nodeHeight } = layoutConfig;
  
  positions.forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + nodeHeight);
  });
  
  return { 
    minX, minY, maxX, maxY, 
    width: maxX + PADDING, 
    height: maxY + PADDING 
  };
}

/**
 * Create the graph canvas container with zoom controls.
 */
function createGraphCanvas() {
  const wrapper = document.createElement('div');
  wrapper.className = 'graph-wrapper';
  wrapper.tabIndex = 0; // Make focusable for keyboard events
  wrapper.style.touchAction = 'none'; // Prevent browser gesture handling
  
  const canvas = document.createElement('div');
  canvas.className = 'graph-canvas';
  canvas.style.touchAction = 'none';
  
  const connectionsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  connectionsLayer.classList.add('graph-connections');
  
  const nodesLayer = document.createElement('div');
  nodesLayer.className = 'graph-nodes';
  
  // Zoom controls
  const zoomControls = document.createElement('div');
  zoomControls.className = 'graph-zoom-controls';
  zoomControls.innerHTML = `
    <button class="graph-zoom-btn" data-zoom="in" title="Zoom in (+)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
      </svg>
    </button>
    <button class="graph-zoom-btn" data-zoom="out" title="Zoom out (-)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/>
      </svg>
    </button>
    <button class="graph-zoom-btn" data-zoom="reset" title="Reset zoom (0)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
    </button>
  `;
  
  canvas.appendChild(connectionsLayer);
  canvas.appendChild(nodesLayer);
  wrapper.appendChild(canvas);
  wrapper.appendChild(zoomControls);
  
  return { wrapper, canvas, connectionsLayer, nodesLayer, zoomControls };
}

/**
 * Extract domain from URL for compact display.
 */
function getDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Create a graph node element.
 * @param {object} options - { node, position, currentId, onNavigate, openNodeIds }
 */
function createGraphNode(node, position, currentId, onNavigate, openNodeIds = null) {
  const nodeEl = document.createElement('div');
  nodeEl.className = 'graph-node';
  nodeEl.dataset.nodeId = node.id;
  nodeEl.style.left = `${position.x}px`;
  nodeEl.style.top = `${position.y}px`;
  nodeEl.style.width = `${layoutConfig.nodeWidth}px`;
  nodeEl.style.height = `${layoutConfig.nodeHeight}px`;
  
  if (layoutConfig.compact) {
    nodeEl.classList.add('compact');
  }
  
  if (node.id === currentId) {
    nodeEl.classList.add('current');
  }
  
  // Mark as closed if in multi-tab mode and not open
  if (openNodeIds !== null && !openNodeIds.has(node.id)) {
    nodeEl.classList.add('closed');
  }
  
  // Favicon
  const favicon = document.createElement('div');
  favicon.className = 'graph-node-favicon';
  if (node.favicon) {
    const img = document.createElement('img');
    img.src = node.favicon;
    img.alt = '';
    img.onerror = () => { favicon.innerHTML = '🌐'; };
    favicon.appendChild(img);
  } else {
    favicon.innerHTML = '🌐';
  }
  
  nodeEl.appendChild(favicon);
  
  // Content - compact mode shows only domain, normal shows title + url
  if (layoutConfig.compact) {
    const domain = document.createElement('div');
    domain.className = 'graph-node-domain';
    domain.textContent = getDomain(node.url);
    domain.title = node.title || node.url; // Show full title on hover
    nodeEl.appendChild(domain);
  } else {
    const content = document.createElement('div');
    content.className = 'graph-node-content';
    content.innerHTML = `
      <div class="graph-node-title">${escapeHtml(node.title || 'Untitled')}</div>
      <div class="graph-node-url">${escapeHtml(formatUrl(node.url))}</div>
    `;
    nodeEl.appendChild(content);
  }
  
  // Click to navigate
  nodeEl.addEventListener('click', (e) => {
    e.stopPropagation();
    onNavigate(node);
  });
  
  return nodeEl;
}

/**
 * Draw connection line between parent and child (vertical layout).
 * Connection goes from bottom of parent to top of child.
 */
function createConnection(parentPos, childPos, branchIndex = 0) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.classList.add('graph-connection');
  path.classList.add(`branch-${(branchIndex % 5) + 1}`);
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
 * @param {object} node - Current node
 * @param {Map} positions - Node positions
 * @param {SVGElement} svg - SVG container
 * @param {Set} pathNodeIds - IDs of nodes on the path to current (for highlighting)
 */
function drawConnections(node, positions, svg, pathNodeIds = null) {
  if (!node || !node.children) return;
  
  const parentPos = positions.get(node.id);
  if (!parentPos) return;
  
  node.children.forEach((child, idx) => {
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
 * @param {object} root - Root node
 * @param {number} targetId - Target node ID
 * @returns {Set<number>} - Set of node IDs on the path
 */
function getPathToNode(root, targetId) {
  const path = new Set();
  
  function findPath(node) {
    if (!node) return false;
    
    path.add(node.id);
    
    if (node.id === targetId) return true;
    
    if (node.children) {
      for (const child of node.children) {
        if (findPath(child)) return true;
      }
    }
    
    path.delete(node.id);
    return false;
  }
  
  findPath(root);
  return path;
}

/**
 * Get path to a target node across all roots in a forest.
 * @param {Array} roots - Array of root nodes
 * @param {number} targetId - Target node ID
 * @returns {Set<number>} - Set of node IDs on the path
 */
function getPathToNodeInForest(roots, targetId) {
  for (const root of roots) {
    const path = getPathToNode(root, targetId);
    if (path.size > 0) return path;
  }
  return new Set();
}

/**
 * Setup pan and zoom for the canvas.
 * Smooth zoom centered on cursor.
 */
function setupPanZoom(wrapper, canvas, bounds, initialTranslate, zoomControls, currentNodeId) {
  let isPanning = false;
  let startX = 0, startY = 0;

  // Restore saved state or use initial position
  const hasState = savedViewState !== null;
  let translateX = hasState ? savedViewState.translateX : initialTranslate.x;
  let translateY = hasState ? savedViewState.translateY : initialTranslate.y;
  let scale = hasState ? savedViewState.scale : 1;

  // Set canvas size
  canvas.style.width = `${bounds.width}px`;
  canvas.style.height = `${bounds.height}px`;
  canvas.style.transition = 'none'; // No CSS transitions - all instant

  function updateTransform() {
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    savedViewState = { translateX, translateY, scale };
  }
  
  // Fit entire tree in view
  function fitToView() {
    const rect = wrapper.getBoundingClientRect();
    const treeWidth = bounds.maxX - bounds.minX + PADDING * 2;
    const treeHeight = bounds.maxY - bounds.minY + PADDING * 2;

    // Calculate scale to fit entire tree
    const scaleX = rect.width / treeWidth;
    const scaleY = rect.height / treeHeight;
    scale = Math.min(scaleX, scaleY, 1.5); // Cap at 150%

    // Center the tree
    translateX = (rect.width - treeWidth * scale) / 2 - (bounds.minX - PADDING) * scale;
    translateY = (rect.height - treeHeight * scale) / 2 - (bounds.minY - PADDING) * scale;

    updateTransform();
  }

  // Zoom function
  function zoom(direction) {
    const rect = wrapper.getBoundingClientRect();
    const pointerX = rect.width / 2;
    const pointerY = rect.height / 2;

    if (direction === 'reset') {
      fitToView();
      return;
    }

    const scaleFactor = direction === 'in' ? 1.25 : 0.8;
    const newScale = Math.min(3, Math.max(0.15, scale * scaleFactor));

    if (newScale !== scale) {
      const canvasX = (pointerX - translateX) / scale;
      const canvasY = (pointerY - translateY) / scale;

      scale = newScale;
      translateX = pointerX - canvasX * scale;
      translateY = pointerY - canvasY * scale;

      updateTransform();
    }
  }
  
  // Zoom at coordinates
  function zoomAt(pointerX, pointerY, scaleFactor) {
    const newScale = Math.min(3, Math.max(0.15, scale * scaleFactor));
    
    if (newScale !== scale) {
      const canvasX = (pointerX - translateX) / scale;
      const canvasY = (pointerY - translateY) / scale;
      
      scale = newScale;
      translateX = pointerX - canvasX * scale;
      translateY = pointerY - canvasY * scale;
      
      updateTransform();
    }
  }
  
  // ========== MOUSE PAN ==========
  wrapper.addEventListener('mousedown', (e) => {
    if (e.target === wrapper || e.target === canvas ||
        e.target.tagName === 'svg' || e.target.tagName === 'path') {
      isPanning = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
      wrapper.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });

  wrapper.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateTransform();
  });

  wrapper.addEventListener('mouseup', () => {
    isPanning = false;
    wrapper.style.cursor = 'grab';
  });

  wrapper.addEventListener('mouseleave', () => {
    isPanning = false;
    wrapper.style.cursor = 'grab';
  });

  // ========== UNIFIED WHEEL HANDLER ==========
  // Handles: trackpad pinch (ctrlKey), modifier+scroll zoom, two-finger pan
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();

    const rect = wrapper.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    // Zoom when:
    // - ctrlKey is set (trackpad pinch on Mac sends this)
    // - Alt/Option + scroll (explicit zoom gesture)
    // - Cmd/Meta + scroll (explicit zoom gesture)
    // - Mouse wheel with deltaMode 1 or 2 (line/page mode - physical scroll wheel)
    const isTrackpadPinch = e.ctrlKey;
    const hasModifier = e.altKey || e.metaKey;
    const isMouseWheel = e.deltaMode === 1 || e.deltaMode === 2;
    const shouldZoom = isTrackpadPinch || hasModifier || isMouseWheel;

    if (shouldZoom) {
      // ZOOM - centered on pointer
      let scaleFactor;

      if (isMouseWheel) {
        // Mouse wheel: larger discrete steps
        scaleFactor = e.deltaY > 0 ? 0.85 : 1.18;
      } else {
        // Trackpad pinch or modifier+scroll: smooth continuous zoom
        // Use smaller factor for smoother feel
        scaleFactor = 1 - e.deltaY * 0.005;
      }

      zoomAt(pointerX, pointerY, scaleFactor);
    } else {
      // PAN - two-finger trackpad scroll
      translateX -= e.deltaX;
      translateY -= e.deltaY;
      updateTransform();
    }
  }, { passive: false });

  // ========== TOUCH SUPPORT (Mobile) ==========
  let lastTouchDistance = 0;

  wrapper.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isPanning = true;
      startX = e.touches[0].clientX - translateX;
      startY = e.touches[0].clientY - translateY;
    } else if (e.touches.length === 2) {
      isPanning = false;
      lastTouchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  wrapper.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isPanning) {
      translateX = e.touches[0].clientX - startX;
      translateY = e.touches[0].clientY - startY;
      updateTransform();
    } else if (e.touches.length === 2 && lastTouchDistance > 0) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };

      const rect = wrapper.getBoundingClientRect();
      const touchX = center.x - rect.left;
      const touchY = center.y - rect.top;

      const scaleDelta = distance / lastTouchDistance;
      zoomAt(touchX, touchY, scaleDelta);

      lastTouchDistance = distance;
    }
  }, { passive: false });

  wrapper.addEventListener('touchend', () => {
    isPanning = false;
    lastTouchDistance = 0;
  });

  wrapper.style.cursor = 'grab';

  // ========== ZOOM CONTROLS ==========
  zoomControls.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-zoom]');
    if (btn) {
      zoom(btn.dataset.zoom);
    }
  });

  // Keyboard shortcuts
  wrapper.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoom('in');
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoom('out');
    } else if (e.key === '0') {
      e.preventDefault();
      zoom('reset');
    }
  });

  // Center view on a specific node (preserves current scale)
  function centerOnNode(nodeId) {
    const nodeEl = wrapper.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeEl) return;

    const rect = wrapper.getBoundingClientRect();
    const nodeRect = nodeEl.getBoundingClientRect();

    // Calculate node center in canvas coordinates
    const nodeCenterX = (nodeRect.left + nodeRect.width / 2 - rect.left - translateX) / scale;
    const nodeCenterY = (nodeRect.top + nodeRect.height / 2 - rect.top - translateY) / scale;

    // Pan to center node in viewport (keep scale unchanged)
    translateX = rect.width / 2 - nodeCenterX * scale;
    translateY = rect.height / 2 - nodeCenterY * scale;

    updateTransform();
  }

  // Expose API for external control
  graphAPI = { centerOnNode, fitToView, wrapper };

  // On first render: fit to view. On re-render: keep current view (no animation)
  if (!hasState) {
    fitToView();
  }
  // Apply initial transform
  updateTransform();

  // Focus wrapper for keyboard events
  wrapper.focus();
}

/**
 * Render graph view.
/**
 * Render graph view.
 * Supports multiple roots (forest structure) - trees are arranged horizontally.
 * @param {object} treeData - Serialized tree data
 * @param {HTMLElement} container - Container element
 * @param {object} options - Render options { onNavigate, openNodeIds, compactGraph }
 * @returns {number|null} - Current node ID
 */
function renderGraphView(treeData, container, options) {
  const { onNavigate, openNodeIds = null, compactGraph = false } = options;
  
  // Set layout config based on compact mode
  if (compactGraph) {
    layoutConfig = {
      nodeWidth: COMPACT_NODE_WIDTH,
      nodeHeight: COMPACT_NODE_HEIGHT,
      verticalGap: COMPACT_VERTICAL_GAP,
      horizontalGap: COMPACT_HORIZONTAL_GAP,
      rootGap: COMPACT_ROOT_GAP,
      compact: true
    };
  } else {
    layoutConfig = {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
      verticalGap: VERTICAL_GAP,
      horizontalGap: HORIZONTAL_GAP,
      rootGap: ROOT_GAP,
      compact: false
    };
  }
  
  // Support both 'roots' array and legacy 'root' field
  const roots = treeData?.roots || (treeData?.root ? [treeData.root] : []);
  const currentId = treeData?.currentNodeId;
  
  // Clear container
  container.innerHTML = '';
  
  if (roots.length === 0) {
    return null;
  }
  
  // Calculate layout for all trees in the forest
  const positions = calculateForestLayout(roots);
  const bounds = getCanvasBounds(positions);
  
  // Create canvas
  const { wrapper, canvas, connectionsLayer, nodesLayer, zoomControls } = createGraphCanvas();
  
  // Set SVG size
  connectionsLayer.setAttribute('width', bounds.width);
  connectionsLayer.setAttribute('height', bounds.height);
  connectionsLayer.style.width = `${bounds.width}px`;
  connectionsLayer.style.height = `${bounds.height}px`;
  
  // Get path to current node for highlighting (search across all roots)
  const pathNodeIds = currentId ? getPathToNodeInForest(roots, currentId) : null;
  
  // Draw connections for each tree
  roots.forEach((root) => {
    drawConnections(root, positions, connectionsLayer, pathNodeIds);
  });
  
  // Create nodes
  positions.forEach((pos) => {
    const nodeEl = createGraphNode(pos.node, pos, currentId, onNavigate, openNodeIds);
    nodesLayer.appendChild(nodeEl);
  });
  
  container.appendChild(wrapper);
  
  // Calculate initial translation to center on current node (or first root)
  const wrapperRect = wrapper.getBoundingClientRect();
  const targetPos = positions.get(currentId) || positions.get(roots[0].id);
  const { nodeWidth, nodeHeight } = layoutConfig;
  
  let initialTranslate = { x: 0, y: 0 };
  if (targetPos) {
    initialTranslate = {
      x: wrapperRect.width / 2 - targetPos.x - nodeWidth / 2,
      y: wrapperRect.height / 3 - targetPos.y - nodeHeight / 2
    };
  }
  
  // Setup pan/zoom after adding to DOM
  setupPanZoom(wrapper, canvas, bounds, initialTranslate, zoomControls, currentId);
  
  return currentId;
}

// Register the renderer
registerRenderer(VIEW_MODE.GRAPH, renderGraphView);

/**
 * Get the graph API for external control (centering, etc.)
 * @returns {{ centerOnNode: Function, wrapper: HTMLElement } | null}
 */
export function getGraphAPI() {
  return graphAPI;
}

export { renderGraphView };
