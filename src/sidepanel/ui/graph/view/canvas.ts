export interface GraphCanvasElements {
  wrapper: HTMLDivElement;
  canvas: HTMLDivElement;
  connectionsLayer: SVGElement;
  nodesLayer: HTMLDivElement;
  zoomControls: HTMLDivElement;
}

/**
 * Create the graph canvas container with zoom controls.
 */
export function createGraphCanvas(): GraphCanvasElements {
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
    <div class="graph-tool-group">
      <button class="graph-tool-btn active" data-tool="hand" title="Hand tool (H) - Pan">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
          <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
          <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
        </svg>
      </button>
      <button class="graph-tool-btn" data-tool="select" title="Select tool (V) - Select nodes">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
          <path d="M13 13l6 6"/>
        </svg>
      </button>
    </div>
    <div class="graph-zoom-divider"></div>
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

