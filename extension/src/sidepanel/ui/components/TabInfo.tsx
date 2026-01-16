import { useStore } from '../state/store.js';
import React from 'react';

export default function TabInfo() {
  const nodeTabCounts = useStore((state) => state.nodeTabCounts);
  const total = Object.values(nodeTabCounts).reduce((sum, count) => sum + count, 0);
  const label = total === 1 ? '1 tab' : `${total} tabs`;

  return (
    <div className="tab-info" id="tabInfo">
      <span className="tab-label">current tab</span>
      <span className="tab-count" id="stackCount">
        {label}
      </span>
    </div>
  );
}
