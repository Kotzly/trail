import { Icons } from '../Icon.js';
import React from 'react';

type GraphZoomControlsProps = {
  tool: 'hand' | 'select';
  onToolChange: (tool: 'hand' | 'select') => void;
  onZoom: (direction: 'in' | 'out' | 'reset') => void;
};

export default function GraphZoomControls({ tool, onToolChange, onZoom }: GraphZoomControlsProps) {
  return (
    <div className="graph-zoom-controls">
      <div className="graph-tool-group">
        <button
          className={`graph-tool-btn ${tool === 'hand' ? 'active' : ''}`}
          data-tool="hand"
          title="Hand tool (H) - Pan"
          type="button"
          onClick={() => onToolChange('hand')}
        >
          <Icons.Hand size={18} />
        </button>
        <button
          className={`graph-tool-btn ${tool === 'select' ? 'active' : ''}`}
          data-tool="select"
          title="Select tool (V) - Select nodes"
          type="button"
          onClick={() => onToolChange('select')}
        >
          <Icons.MousePointer2 size={18} />
        </button>
      </div>
      <div className="graph-zoom-divider" />
      <button className="graph-zoom-btn" data-zoom="in" title="Zoom in (+)" type="button" onClick={() => onZoom('in')}>
        <Icons.ZoomIn size={18} />
      </button>
      <button className="graph-zoom-btn" data-zoom="out" title="Zoom out (-)" type="button" onClick={() => onZoom('out')}>
        <Icons.ZoomOut size={18} />
      </button>
      <button className="graph-zoom-btn" data-zoom="reset" title="Reset zoom (0)" type="button" onClick={() => onZoom('reset')}>
        <Icons.RefreshCw size={18} />
      </button>
    </div>
  );
}
