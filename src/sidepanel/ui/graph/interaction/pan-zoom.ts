import type { NodeId } from '../../../../shared/types/ids';
import type { CanvasBounds, GraphAPI } from '../types';
import { PADDING } from '../layout/config';
import { GraphState } from '../state/graph-state';
import { showBulkContextMenu } from '../menus/context-menu';

export function setupPanZoom(
  wrapper: HTMLElement,
  canvas: HTMLElement,
  bounds: CanvasBounds,
  initialTranslate: { x: number; y: number },
  zoomControls: HTMLElement,
): GraphAPI {
  let isPanning = false;
  let startX = 0, startY = 0;

  // Restore saved state or use initial position
  const savedState = GraphState.getSavedViewState();
  const hasState = savedState !== null;
  let translateX = hasState ? savedState.translateX : initialTranslate.x;
  let translateY = hasState ? savedState.translateY : initialTranslate.y;
  let scale = hasState ? savedState.scale : 1;

  // Set canvas size
  canvas.style.width = `${bounds.width}px`;
  canvas.style.height = `${bounds.height}px`;
  canvas.style.transition = 'none'; // No CSS transitions by default

  function updateTransform(animate = false): void {
    if (animate) {
      canvas.style.transition = 'transform 0.3s ease-out';
      // Remove transition after animation completes
      setTimeout(() => {
        canvas.style.transition = 'none';
      }, 300);
    } else {
      canvas.style.transition = 'none';
    }
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    GraphState.setSavedViewState({ translateX, translateY, scale });
  }
  
  // Fit entire tree in view
  function fitToView(animate = false): void {
    const rect = wrapper.getBoundingClientRect();
    const treeWidth = bounds.maxX - bounds.minX + PADDING * 2;
    const treeHeight = bounds.maxY - bounds.minY + PADDING * 2;

    // Calculate scale to fit entire tree with some margin (90% of viewport)
    const scaleX = (rect.width * 0.9) / treeWidth;
    const scaleY = (rect.height * 0.9) / treeHeight;
    scale = Math.min(scaleX, scaleY, 2); // Allow up to 2x zoom for small trees

    // Center the tree
    translateX = (rect.width - treeWidth * scale) / 2 - (bounds.minX - PADDING) * scale;
    translateY = (rect.height - treeHeight * scale) / 2 - (bounds.minY - PADDING) * scale;

    updateTransform(animate);
  }

  // Zoom function
  function zoom(direction: 'in' | 'out' | 'reset'): void {
    const rect = wrapper.getBoundingClientRect();
    const pointerX = rect.width / 2;
    const pointerY = rect.height / 2;

    if (direction === 'reset') {
      fitToView(true);
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

      updateTransform(true);
    }
  }
  
  // Zoom at coordinates
  function zoomAt(pointerX: number, pointerY: number, scaleFactor: number): void {
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
  
  // ========== SELECTION STATE ==========
  let isSelecting = false;
  let selectionStartX = 0;
  let selectionStartY = 0;
  let selectionBox: HTMLElement | null = null;
  let baseSelection = new Set<NodeId>();
  let liveSelection = new Set<NodeId>();

  function createSelectionBox(x: number, y: number): void {
    selectionBox = document.createElement('div');
    selectionBox.className = 'graph-selection-box';
    selectionBox.style.left = `${x}px`;
    selectionBox.style.top = `${y}px`;
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    wrapper.appendChild(selectionBox);
  }
  
  function updateSelectionBox(x: number, y: number): void {
    if (!selectionBox) return;
    
    const left = Math.min(selectionStartX, x);
    const top = Math.min(selectionStartY, y);
    const width = Math.abs(x - selectionStartX);
    const height = Math.abs(y - selectionStartY);
    
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
  }

  function applySelectionPreview(intersects: Set<NodeId>, shiftKey: boolean): void {
    const nodes = wrapper.querySelectorAll('.graph-node');
    liveSelection.clear();
    if (shiftKey) {
      baseSelection.forEach(id => liveSelection.add(id));
    }
    intersects.forEach(id => liveSelection.add(id));

    nodes.forEach(nodeEl => {
      const nodeId = parseInt((nodeEl as HTMLElement).dataset.nodeId || '0', 10) as NodeId;
      if (liveSelection.has(nodeId)) {
        nodeEl.classList.add('selected-preview');
      } else {
        nodeEl.classList.remove('selected-preview');
      }
    });
  }

  function finalizeSelection(mouseEvent: MouseEvent | null): void {
    if (!selectionBox) return;
    
    const boxRect = selectionBox.getBoundingClientRect();
    const nodes = wrapper.querySelectorAll('.graph-node');
    const intersects = new Set<NodeId>();
    
    // Find nodes within selection box
    nodes.forEach(nodeEl => {
      const nodeRect = nodeEl.getBoundingClientRect();
      const intersectsBox = !(
        nodeRect.right < boxRect.left ||
        nodeRect.left > boxRect.right ||
        nodeRect.bottom < boxRect.top ||
        nodeRect.top > boxRect.bottom
      );
      
      if (intersectsBox) {
        const nodeId = parseInt((nodeEl as HTMLElement).dataset.nodeId || '0', 10) as NodeId;
        intersects.add(nodeId);
      }
    });
    
    // Apply final selection
    const currentSelected = GraphState.getSelectedNodeIds();
    if (mouseEvent?.shiftKey) {
      GraphState.setSelectedNodeIds(new Set([...baseSelection, ...intersects]));
    } else {
      GraphState.setSelectedNodeIds(intersects);
    }

    clearSelectionHighlights();
    const finalSelected = GraphState.getSelectedNodeIds();
    finalSelected.forEach(id => {
      const nodeEl = wrapper.querySelector(`.graph-node[data-node-id="${id}"]`) as HTMLElement | null;
      if (nodeEl) nodeEl.classList.add('selected');
    });
    
    // Cleanup previews/box
    liveSelection.clear();
    wrapper.querySelectorAll('.graph-node.selected-preview').forEach(el => el.classList.remove('selected-preview'));
    removeSelectionBox();
    
    const finalSelectedIds = GraphState.getSelectedNodeIds();
    if (finalSelectedIds.size > 0 && mouseEvent) {
      showBulkContextMenu(mouseEvent, finalSelectedIds);
    }
  }

  // ========== MOUSE PAN / SELECT ==========
  wrapper.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    if (target === wrapper || target === canvas ||
        target.tagName === 'svg' || target.tagName === 'path') {
      
      const currentTool = GraphState.getCurrentTool();
      if (currentTool === 'hand') {
        // Hand tool: panning
        isPanning = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
        wrapper.style.cursor = 'grabbing';
      } else if (currentTool === 'select') {
        // Select tool: start selection box
        isSelecting = true;
        const currentSelected = GraphState.getSelectedNodeIds();
        baseSelection = new Set(currentSelected);
        liveSelection.clear();
        wrapper.querySelectorAll('.graph-node.selected-preview').forEach(el => el.classList.remove('selected-preview'));
        const rect = wrapper.getBoundingClientRect();
        selectionStartX = e.clientX - rect.left;
        selectionStartY = e.clientY - rect.top;
        createSelectionBox(selectionStartX, selectionStartY);
      }
      e.preventDefault();
    }
  });

  wrapper.addEventListener('mousemove', (e) => {
    if (isPanning) {
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      updateTransform();
    } else if (isSelecting) {
      const rect = wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      updateSelectionBox(x, y);
      
      // Live selection preview
      if (selectionBox) {
        const boxRect = selectionBox.getBoundingClientRect();
        const nodes = wrapper.querySelectorAll('.graph-node');
        const intersects = new Set<NodeId>();
        nodes.forEach(nodeEl => {
          const nodeRect = nodeEl.getBoundingClientRect();
          const intersectsBox = !(
            nodeRect.right < boxRect.left ||
            nodeRect.left > boxRect.right ||
            nodeRect.bottom < boxRect.top ||
            nodeRect.top > boxRect.bottom
          );
          if (intersectsBox) {
            const nodeId = parseInt((nodeEl as HTMLElement).dataset.nodeId || '0', 10) as NodeId;
            intersects.add(nodeId);
          }
        });
        applySelectionPreview(intersects, e.shiftKey);
      }
    }
  });

  wrapper.addEventListener('mouseup', (e) => {
    if (isPanning) {
      isPanning = false;
    } else if (isSelecting) {
      finalizeSelection(e);
      isSelecting = false;
    }
    updateCursor();
  });

  wrapper.addEventListener('mouseleave', () => {
    if (isPanning) {
      isPanning = false;
    } else if (isSelecting) {
      finalizeSelection(null);
      isSelecting = false;
    }
    updateCursor();
  });

  // ========== UNIFIED WHEEL HANDLER ==========
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault();

    const rect = wrapper.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    const isTrackpadPinch = e.ctrlKey;
    const hasModifier = e.altKey || e.metaKey;
    const isMouseWheel = e.deltaMode === 1 || e.deltaMode === 2;
    const shouldZoom = isTrackpadPinch || hasModifier || isMouseWheel;

    if (shouldZoom) {
      let scaleFactor: number;
      if (isMouseWheel) {
        scaleFactor = e.deltaY > 0 ? 0.85 : 1.18;
      } else {
        scaleFactor = 1 - e.deltaY * 0.005;
      }
      zoomAt(pointerX, pointerY, scaleFactor);
    } else {
      translateX -= e.deltaX;
      translateY -= e.deltaY;
      updateTransform();
    }
  }, { passive: false });

  // ========== TOUCH SUPPORT (Mobile) ==========
  let lastTouchDistance = 0;

  wrapper.addEventListener('touchstart', (e) => {
    const t0 = e.touches.item(0); // <- item() возвращает Touch | null
    if (e.touches.length === 1 && t0) {
      isPanning = true;
      startX = t0.clientX - translateX;
      startY = t0.clientY - translateY;
      return;
    }
  
    const t1 = e.touches.item(1);
    if (e.touches.length === 2 && t0 && t1) {
      isPanning = false;
      lastTouchDistance = Math.hypot(
        t0.clientX - t1.clientX,
        t0.clientY - t1.clientY
      );
    }
  }, { passive: true });
  

  wrapper.addEventListener('touchmove', (e) => {
    e.preventDefault();
  
    const t0 = e.touches.item(0);
  
    // 1 finger pan
    if (e.touches.length === 1 && t0 && isPanning) {
      translateX = t0.clientX - startX;
      translateY = t0.clientY - startY;
      updateTransform();
      return;
    }
  
    // 2 finger pinch zoom
    const t1 = e.touches.item(1);
    if (e.touches.length === 2 && t0 && t1 && lastTouchDistance > 0) {
      const distance = Math.hypot(
        t0.clientX - t1.clientX,
        t0.clientY - t1.clientY
      );
  
      const centerX = (t0.clientX + t1.clientX) / 2;
      const centerY = (t0.clientY + t1.clientY) / 2;
  
      const rect = wrapper.getBoundingClientRect();
      const touchX = centerX - rect.left;
      const touchY = centerY - rect.top;
  
      const scaleDelta = distance / lastTouchDistance;
      zoomAt(touchX, touchY, scaleDelta);
  
      lastTouchDistance = distance;
    }
  }, { passive: false });
  

  wrapper.addEventListener('touchend', () => {
    isPanning = false;
    lastTouchDistance = 0;
  });

  // Update cursor based on tool
  function updateCursor(): void {
    const currentTool = GraphState.getCurrentTool();
    if (currentTool === 'hand') {
      wrapper.style.cursor = isPanning ? 'grabbing' : 'grab';
    } else {
      wrapper.style.cursor = 'crosshair';
    }
  }
  updateCursor();

  // ========== TOOL SWITCHING ==========
  function setTool(tool: 'hand' | 'select'): void {
    GraphState.setCurrentTool(tool);
    GraphState.setSelectedNodeIds(new Set());
    clearSelectionHighlights();
    removeSelectionBox();
    
    // Update button states
    zoomControls.querySelectorAll('[data-tool]').forEach(btn => {
      const btnEl = btn as HTMLElement;
      btnEl.classList.toggle('active', btnEl.dataset.tool === tool);
    });
    
    updateCursor();
  }
  
  function clearSelectionHighlights(): void {
    wrapper.querySelectorAll('.graph-node.selected, .graph-node.selected-preview').forEach(el => {
      el.classList.remove('selected', 'selected-preview');
    });
  }
  
  function removeSelectionBox(): void {
    const existing = wrapper.querySelector('.graph-selection-box');
    if (existing) existing.remove();
    selectionBox = null;
  }

  // ========== ZOOM CONTROLS ==========
  zoomControls.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const zoomBtn = target.closest('[data-zoom]') as HTMLElement | null;
    if (zoomBtn) {
      const zoomDir = zoomBtn.dataset.zoom as 'in' | 'out' | 'reset';
      zoom(zoomDir);
      return;
    }
    
    const toolBtn = target.closest('[data-tool]') as HTMLElement | null;
    if (toolBtn) {
      const tool = toolBtn.dataset.tool as 'hand' | 'select';
      setTool(tool);
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
    } else if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      setTool('hand');
    } else if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      setTool('select');
    } else if (e.key === 'Escape') {
      GraphState.setSelectedNodeIds(new Set());
      clearSelectionHighlights();
      removeSelectionBox();
    }
  });

  // Center view on a specific node (preserves current scale)
  function centerOnNode(nodeId: NodeId, animate = true): void {
    const nodeEl = wrapper.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
    if (!nodeEl) return;

    const rect = wrapper.getBoundingClientRect();
    const nodeRect = nodeEl.getBoundingClientRect();

    // Calculate node center in canvas coordinates
    const nodeCenterX = (nodeRect.left + nodeRect.width / 2 - rect.left - translateX) / scale;
    const nodeCenterY = (nodeRect.top + nodeRect.height / 2 - rect.top - translateY) / scale;

    // Pan to center node in viewport (keep scale unchanged)
    translateX = rect.width / 2 - nodeCenterX * scale;
    translateY = rect.height / 2 - nodeCenterY * scale;

    updateTransform(animate);
  }

  // Expose API for external control
  const graphAPI: GraphAPI = { centerOnNode, fitToView, wrapper };

  // On first render: fit to view. On re-render: keep current view (no animation)
  if (!hasState) {
    fitToView();
  }
  // Apply initial transform
  updateTransform();
  
  // ========== BULK CONTEXT MENU ==========
  wrapper.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    if (target === wrapper || target === canvas ||
        target.tagName === 'svg' || target.tagName === 'path') {
      const selectedNodeIds = GraphState.getSelectedNodeIds();
      if (selectedNodeIds.size > 0) {
        showBulkContextMenu(e, selectedNodeIds);
      }
    }
  });

  // Focus wrapper for keyboard events
  wrapper.focus();
  
  return graphAPI;
}

