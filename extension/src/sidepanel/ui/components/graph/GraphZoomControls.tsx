import { Icons } from '../Icon.js';
import React from 'react';

type GraphZoomControlsProps = {
  tool: 'hand' | 'select';
  onToolChange: (tool: 'hand' | 'select') => void;
  onZoom: (direction: 'in' | 'out' | 'reset') => void;
};

export default function GraphZoomControls({ tool, onToolChange, onZoom }: GraphZoomControlsProps) {
  return (
    <div className="graph-zoom-controls" data-graph-ui="true">
        <button
          className={`graph-control-btn ${tool === 'select' ? 'active' : ''}`}
          data-tool="select"
          title="Select tool (V) - Select nodes"
          data-tooltip="Select tool (V)"
          data-tooltip-position="left"
          type="button"
          onClick={() => onToolChange('select')}
        >
          <Icons.MousePointer2 size={18} />
        </button>
        <button
          className={`graph-control-btn ${tool === 'hand' ? 'active' : ''}`}
          data-tool="hand"
          title="Hand tool (H) - Pan"
          data-tooltip="Hand tool (H)"
          data-tooltip-position="left"
          type="button"
          onClick={() => onToolChange('hand')}
        >
          <Icons.Hand size={18} />
        </button>
      <div className="graph-zoom-divider" />
      <button
        className="graph-control-btn"
        data-zoom="in"
        title="Zoom in (+)"
        data-tooltip="Zoom in (+)"
        data-tooltip-position="left"
        type="button"
        onClick={() => onZoom('in')}
      >
        <Icons.ZoomIn size={18} />
      </button>
      <button
        className="graph-control-btn"
        data-zoom="out"
        title="Zoom out (-)"
        data-tooltip="Zoom out (-)"
        data-tooltip-position="left"
        type="button"
        onClick={() => onZoom('out')}
      >
        <Icons.ZoomOut size={18} />
      </button>
      <button
        className="graph-control-btn"
        data-zoom="reset"
        title="Reset zoom (0)"
        data-tooltip="Reset zoom (0)"
        data-tooltip-position="left"
        type="button"
        onClick={() => onZoom('reset')}
      >
        <Icons.RefreshCw size={18} />
      </button>
    </div>
  );
}
