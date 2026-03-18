import assert from 'node:assert/strict';
import { SpatialIndex } from '../src/entrypoints/sidepanel/ui/graph/render/spatial-index.js';
import type { Rect } from '../src/entrypoints/sidepanel/ui/graph/render/spatial-index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a rect centered at (cx, cy) with given width/height. */
function rectAt(cx: number, cy: number, w = 100, h = 60): Rect {
  return {
    minX: cx - w / 2,
    minY: cy - h / 2,
    maxX: cx + w / 2,
    maxY: cy + h / 2,
  };
}

// ---------------------------------------------------------------------------
// queryNearest tests
// ---------------------------------------------------------------------------

console.log('--- SpatialIndex.queryNearest ---');

{
  console.log('  empty index returns null');
  const idx = new SpatialIndex<string>(200);
  const result = idx.queryNearest(0, 0, 500);
  assert.equal(result, null);
}

{
  console.log('  single item within radius returns it');
  const idx = new SpatialIndex<string>(200);
  idx.insert('a', rectAt(100, 100));
  const result = idx.queryNearest(120, 120, 500);
  assert.ok(result !== null);
  assert.equal(result.id, 'a');
  // Distance from (120,120) to center (100,100) = sqrt(800) ~ 28.28
  assert.ok(result.dist < 30, `expected dist < 30, got ${result.dist}`);
}

{
  console.log('  multiple items returns nearest by center distance');
  const idx = new SpatialIndex<string>(200);
  idx.insert('a', rectAt(0, 0));       // center (0, 0)
  idx.insert('b', rectAt(100, 0));     // center (100, 0)
  idx.insert('c', rectAt(300, 0));     // center (300, 0)

  const result = idx.queryNearest(90, 0, 500);
  assert.ok(result !== null);
  assert.equal(result.id, 'b'); // closest to (90,0) is (100,0) at dist=10
}

{
  console.log('  excludeIds skips matching items');
  const idx = new SpatialIndex<string>(200);
  idx.insert('a', rectAt(0, 0));     // center (0,0) — closest
  idx.insert('b', rectAt(100, 0));   // center (100,0) — next closest
  idx.insert('c', rectAt(300, 0));   // center (300,0)

  const exclude = new Set(['a']);
  const result = idx.queryNearest(0, 0, 500, exclude);
  assert.ok(result !== null);
  assert.equal(result.id, 'b'); // 'a' excluded, so 'b' is nearest
}

{
  console.log('  radius boundary — item at exactly radius distance');
  const idx = new SpatialIndex<string>(200);
  // Center at (100, 0), query from (0, 0), radius 100 — exactly on boundary
  idx.insert('a', rectAt(100, 0));
  const result = idx.queryNearest(0, 0, 100);
  // At exactly radius should be included (<=)
  assert.ok(result !== null);
  assert.equal(result.id, 'a');
  assert.ok(Math.abs(result.dist - 100) < 0.001, `expected dist ~ 100, got ${result.dist}`);
}

{
  console.log('  item outside radius returns null');
  const idx = new SpatialIndex<string>(200);
  idx.insert('a', rectAt(500, 500));
  const result = idx.queryNearest(0, 0, 50);
  assert.equal(result, null);
}

{
  console.log('  excludeIds filters all candidates returns null');
  const idx = new SpatialIndex<string>(200);
  idx.insert('a', rectAt(0, 0));
  idx.insert('b', rectAt(10, 0));
  const exclude = new Set(['a', 'b']);
  const result = idx.queryNearest(0, 0, 500, exclude);
  assert.equal(result, null);
}

{
  console.log('  works with numeric IDs');
  const idx = new SpatialIndex<number>(200);
  idx.insert(1, rectAt(0, 0));
  idx.insert(2, rectAt(50, 50));
  const result = idx.queryNearest(45, 45, 100);
  assert.ok(result !== null);
  assert.equal(result.id, 2);
}

console.log('All spatial-index tests passed.');
