export const clampRange = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
};

export const getRangePercent = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * 100;
};
