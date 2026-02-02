import type { ViewState } from '../../graph/types.js';

const GRID_BASE_SIZE = 20;
const GRID_BASE_DOT_SIZE = 1.5;
const GRID_MIN_DOT_SCALE = 0.5;

export type GraphGridTransform = {
  size: number;
  dotSize: number;
  offsetX: number;
  offsetY: number;
};

const normalizeModulo = (value: number, modulus: number) => {
  if (!Number.isFinite(modulus) || modulus === 0) return 0;
  const result = value % modulus;
  return result < 0 ? result + modulus : result;
};

export function computeGraphGridTransform(view: ViewState): GraphGridTransform {
  const scale = view.scale;
  const size = GRID_BASE_SIZE * scale;
  const dotSize = GRID_BASE_DOT_SIZE * Math.max(scale, GRID_MIN_DOT_SCALE);
  return {
    size,
    dotSize,
    offsetX: normalizeModulo(view.translateX, size),
    offsetY: normalizeModulo(view.translateY, size),
  };
}
