/**
 * Simple 2D Perlin-style noise for particle drift.
 * Based on a hash-and-interpolate approach -- not crypto-grade,
 * but smooth enough for organic-looking motion.
 */

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (h ^ (h >> 16)) & 0xff;
}

function grad(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : -x;
  const v = h === 0 || h === 3 ? y : -y;
  return u + v;
}

export function noise2D(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const u = fade(xf);
  const v = fade(yf);

  const n00 = grad(hash(xi, yi), xf, yf);
  const n10 = grad(hash(xi + 1, yi), xf - 1, yf);
  const n01 = grad(hash(xi, yi + 1), xf, yf - 1);
  const n11 = grad(hash(xi + 1, yi + 1), xf - 1, yf - 1);

  const nx0 = lerp(n00, n10, u);
  const nx1 = lerp(n01, n11, u);

  return lerp(nx0, nx1, v) * 0.5 + 0.5;
}

/** Seeded pseudo-random for deterministic particle generation */
export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}
