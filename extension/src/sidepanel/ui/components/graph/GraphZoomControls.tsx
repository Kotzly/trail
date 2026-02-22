import { Icons } from '../Icon.js';
import React from 'react';

type GraphZoomControlsProps = {
  tool: 'hand' | 'select';
  onToolChange: (tool: 'hand' | 'select') => void;
  onZoom: (direction: 'in' | 'out' | 'reset') => void;
  onOpenFullView: () => void;
};

export default function GraphZoomControls({ tool, onToolChange, onZoom, onOpenFullView }: GraphZoomControlsProps) {
  return (
    <div className="graph-zoom-controls" data-graph-ui="true">
        <button
          className={`graph-control-btn ${tool === 'select' ? 'active' : ''}`}
          data-tool="select"
          aria-label="Select tool (V) - Select nodes"
          data-tooltip="Select tool (V)"
          type="button"
          onClick={() => onToolChange('select')}
        >
          <Icons.MousePointer2 size={18} />
        </button>
        <button
          className={`graph-control-btn ${tool === 'hand' ? 'active' : ''}`}
          data-tool="hand"
          aria-label="Hand tool (H) - Pan"
          data-tooltip="Hand tool (H)"
          type="button"
          onClick={() => onToolChange('hand')}
        >
          <Icons.Hand size={18} />
        </button>
      <div className="graph-zoom-divider" />
      <button
        className="graph-control-btn"
        data-zoom="in"
        aria-label="Zoom in (+)"
        data-tooltip="Zoom in (+)"
        type="button"
        onClick={() => onZoom('in')}
      >
        <Icons.ZoomIn size={18} />
      </button>
      <button
        className="graph-control-btn"
        data-zoom="out"
        aria-label="Zoom out (-)"
        data-tooltip="Zoom out (-)"
        type="button"
        onClick={() => onZoom('out')}
      >
        <Icons.ZoomOut size={18} />
      </button>
      <button
        className="graph-control-btn"
        data-zoom="reset"
        aria-label="Reset zoom (0)"
        data-tooltip="Reset zoom (0)"
        type="button"
        onClick={() => onZoom('reset')}
      >
        <Icons.RefreshCw size={18} />
      </button>
      <div className="graph-zoom-divider" />
      <button
        className="graph-control-btn"
        aria-label="Open full view"
        data-tooltip="Open full view"
        type="button"
        onClick={onOpenFullView}
      >
        <Icons.ExternalLink size={18} />
      </button>
    </div>
  );
}
