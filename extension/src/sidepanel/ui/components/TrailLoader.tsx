import React from 'react';
import TrailLogo from './TrailLogo.js';

export type TrailLoaderProps = {
  label?: string;
};

export default function TrailLoader({ label = 'Loading' }: TrailLoaderProps) {
  return (
    <div className="trail-loader" role="status" aria-live="polite">
      <div className="trail-loader__content">
        <TrailLogo animated />
        <span className="trail-loader__label">{label}</span>
      </div>
    </div>
  );
}
