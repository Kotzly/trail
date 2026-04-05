import type { ViewState } from "../../graph/types.js";

const GRID_BASE_SIZE = 20;
const GRID_BASE_DOT_SIZE = 1.5;
const GRID_MIN_DOT_PX = 1;
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
  const band =
    Number.isFinite(scale) && scale > 0 && scale < 1
      ? Math.max(0, Math.floor(Math.log2(1 / scale)))
      : 0;
  const bandMultiplier = Math.pow(2, band);
  const size = GRID_BASE_SIZE * scale * bandMultiplier;
  const dotSize = Math.max(GRID_BASE_DOT_SIZE * scale, GRID_MIN_DOT_PX);
  return {
    size,
    dotSize,
    offsetX: normalizeModulo(view.translateX, size),
    offsetY: normalizeModulo(view.translateY, size),
  };
}
