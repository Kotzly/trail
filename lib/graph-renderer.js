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
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const VERTICAL_GAP = 60;   // Gap between parent and children (Y direction)
const HORIZONTAL_GAP = 24; // Gap between sibling nodes (X direction)
const PADDING = 40;

/**
 * Calculate positions for all nodes in the tree.
 * Vertical layout: root at top, children below, spreading horizontally.
 * Uses proper subtree width calculation to avoid overlapping.
 * @param {object} root - Root node
 * @returns {Map<number, {x: number, y: number, node: object}>}
 */
function calculateLayout(root) {
  const positions = new Map();
  const subtreeWidths = new Map();
  
  // First pass: calculate subtree widths (bottom-up)
  function calcWidths(node) {
    if (!node) return 0;
    if (!node.children || node.children.length === 0) {
      subtreeWidths.set(node.id, NODE_WIDTH);
      return NODE_WIDTH;
    }
    
    let totalWidth = 0;
    node.children.forEach((child, idx) => {
      totalWidth += calcWidths(child);
      if (idx < node.children.length - 1) {
        totalWidth += HORIZONTAL_GAP;
      }
    });
    
    const width = Math.max(NODE_WIDTH, totalWidth);
    subtreeWidths.set(node.id, width);
    return width;
  }
  
  calcWidths(root);
  
  // Second pass: assign positions (top-down)
  function layoutNode(node, x, y) {
    if (!node) return;
    
    const subtreeWidth = subtreeWidths.get(node.id) || NODE_WIDTH;
    
    // Center this node within its subtree width
    const nodeX = x + (subtreeWidth - NODE_WIDTH) / 2;
    positions.set(node.id, { x: nodeX, y, node });
    
    if (!node.children || node.children.length === 0) {
      return;
    }
    
    // Position children below
    const childY = y + NODE_HEIGHT + VERTICAL_GAP;
    let childX = x;
    
    node.children.forEach((child) => {
      const childWidth = subtreeWidths.get(child.id) || NODE_WIDTH;
      layoutNode(child, childX, childY);
      childX += childWidth + HORIZONTAL_GAP;
    });
  }
  
  layoutNode(root, PADDING, PADDING);
  
  return positions;
}

/**
 * Get canvas bounds from positions.
 */
function getCanvasBounds(positions) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  positions.forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + NODE_WIDTH);
    maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
  });
  
  return { 
    minX, minY, maxX, maxY, 
    width: maxX + PADDING, 
    height: maxY + PADDING 
  };
}

/**
 * Create the graph canvas container.
 */
function createGraphCanvas() {
  const wrapper = document.createElement('div');
  wrapper.className = 'graph-wrapper';
  
  const canvas = document.createElement('div');
  canvas.className = 'graph-canvas';
  
  const connectionsLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  connectionsLayer.classList.add('graph-connections');
  
  const nodesLayer = document.createElement('div');
  nodesLayer.className = 'graph-nodes';
  
  canvas.appendChild(connectionsLayer);
  canvas.appendChild(nodesLayer);
  wrapper.appendChild(canvas);
  
  return { wrapper, canvas, connectionsLayer, nodesLayer };
}

/**
 * Create a graph node element.
 */
function createGraphNode(node, position, currentId, onNavigate) {
  const nodeEl = document.createElement('div');
  nodeEl.className = 'graph-node';
  nodeEl.dataset.nodeId = node.id;
  nodeEl.style.left = `${position.x}px`;
  nodeEl.style.top = `${position.y}px`;
  
  if (node.id === currentId) {
    nodeEl.classList.add('current');
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
  
  // Content
  const content = document.createElement('div');
  content.className = 'graph-node-content';
  content.innerHTML = `
    <div class="graph-node-title">${escapeHtml(node.title || 'Untitled')}</div>
    <div class="graph-node-url">${escapeHtml(formatUrl(node.url))}</div>
  `;
  
  nodeEl.appendChild(favicon);
  nodeEl.appendChild(content);
  
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
  
  // Start from bottom center of parent
  const startX = parentPos.x + NODE_WIDTH / 2;
  const startY = parentPos.y + NODE_HEIGHT;
  
  // End at top center of child
  const endX = childPos.x + NODE_WIDTH / 2;
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
function drawConnections(node, positions, svg) {
  if (!node || !node.children) return;
  
  const parentPos = positions.get(node.id);
  if (!parentPos) return;
  
  node.children.forEach((child, idx) => {
    const childPos = positions.get(child.id);
    if (childPos) {
      const connection = createConnection(parentPos, childPos, idx);
      svg.appendChild(connection);
      drawConnections(child, positions, svg);
    }
  });
}

/**
 * Setup pan and zoom for the canvas.
 * Smooth zoom centered on cursor.
 */
function setupPanZoom(wrapper, canvas, bounds, initialTranslate) {
  let isPanning = false;
  let startX = 0, startY = 0;
  let translateX = initialTranslate.x;
  let translateY = initialTranslate.y;
  let scale = 1;
  
  // Set canvas size
  canvas.style.width = `${bounds.width}px`;
  canvas.style.height = `${bounds.height}px`;
  
  function updateTransform() {
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }
  
  // Initial transform
  updateTransform();
  
  // Mouse pan
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
  
  // Smooth wheel zoom centered on cursor
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    // Slower, smoother zoom (0.03 per scroll tick)
    const zoomIntensity = 0.03;
    const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
    const newScale = Math.min(2, Math.max(0.2, scale + delta));
    
    if (newScale === scale) return;
    
    // Get cursor position relative to wrapper
    const rect = wrapper.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate the point on the canvas under the cursor (before zoom)
    const canvasX = (mouseX - translateX) / scale;
    const canvasY = (mouseY - translateY) / scale;
    
    // Update scale
    scale = newScale;
    
    // Adjust translation so the point under cursor stays in place
    translateX = mouseX - canvasX * scale;
    translateY = mouseY - canvasY * scale;
    
    updateTransform();
  }, { passive: false });
  
  // Touch support
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
  });
  
  wrapper.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && isPanning) {
      translateX = e.touches[0].clientX - startX;
      translateY = e.touches[0].clientY - startY;
      updateTransform();
    } else if (e.touches.length === 2) {
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
      
      const canvasX = (touchX - translateX) / scale;
      const canvasY = (touchY - translateY) / scale;
      
      const scaleDelta = distance / lastTouchDistance;
      scale = Math.min(2, Math.max(0.2, scale * scaleDelta));
      
      translateX = touchX - canvasX * scale;
      translateY = touchY - canvasY * scale;
      
      lastTouchDistance = distance;
      
      updateTransform();
    }
  }, { passive: false });
  
  wrapper.addEventListener('touchend', () => {
    isPanning = false;
  });
  
  wrapper.style.cursor = 'grab';
}

/**
 * Render graph view.
 * @param {object} treeData - Serialized tree data
 * @param {HTMLElement} container - Container element
 * @param {object} options - Render options { onNavigate: Function }
 * @returns {number|null} - Current node ID
 */
function renderGraphView(treeData, container, options) {
  const { onNavigate } = options;
  
  const root = treeData?.root;
  const currentId = treeData?.currentNodeId;
  
  // Clear container
  container.innerHTML = '';
  
  if (!root) {
    return null;
  }
  
  // Calculate layout
  const positions = calculateLayout(root);
  const bounds = getCanvasBounds(positions);
  
  // Create canvas
  const { wrapper, canvas, connectionsLayer, nodesLayer } = createGraphCanvas();
  
  // Set SVG size
  connectionsLayer.setAttribute('width', bounds.width);
  connectionsLayer.setAttribute('height', bounds.height);
  connectionsLayer.style.width = `${bounds.width}px`;
  connectionsLayer.style.height = `${bounds.height}px`;
  
  // Draw connections first (so they're behind nodes)
  drawConnections(root, positions, connectionsLayer);
  
  // Create nodes
  positions.forEach((pos) => {
    const nodeEl = createGraphNode(pos.node, pos, currentId, onNavigate);
    nodesLayer.appendChild(nodeEl);
  });
  
  container.appendChild(wrapper);
  
  // Calculate initial translation to center on current node (or root)
  const wrapperRect = wrapper.getBoundingClientRect();
  const targetPos = positions.get(currentId) || positions.get(root.id);
  
  let initialTranslate = { x: 0, y: 0 };
  if (targetPos) {
    initialTranslate = {
      x: wrapperRect.width / 2 - targetPos.x - NODE_WIDTH / 2,
      y: wrapperRect.height / 3 - targetPos.y - NODE_HEIGHT / 2
    };
  }
  
  // Setup pan/zoom after adding to DOM
  setupPanZoom(wrapper, canvas, bounds, initialTranslate);
  
  return currentId;
}

// Register the renderer
registerRenderer(VIEW_MODE.GRAPH, renderGraphView);

export { renderGraphView };
