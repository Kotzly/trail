/**
 * Per-phase timing profiler for the graph rendering pipeline.
 *
 * Collects performance.now() durations in a circular Float64Array buffer
 * and exposes p50 / p95 percentile stats over a sliding window.
 *
 * Usage:
 *   import { graphProfiler, profileSync } from './graph-profiler.js';
 *   graphProfiler.record('setData', elapsed);
 *   const result = profileSync('layout', () => calculateLayout(...));
 *
 * Console API:
 *   window.__graphMetrics()   // prints table + returns raw stats
 */

export type ProfilePhase =
  | 'layout'
  | 'renderNodes'
  | 'buildConnections'
  | 'computeOffsetPositions'
  | 'setData'
  | 'updateVisible'
  | 'updateConnections';

const ALL_PHASES: readonly ProfilePhase[] = [
  'layout',
  'renderNodes',
  'buildConnections',
  'computeOffsetPositions',
  'setData',
  'updateVisible',
  'updateConnections',
] as const;

type PhaseBuffer = {
  readonly samples: Float64Array;
  writeIndex: number;
  count: number;
};

export class GraphProfiler {
  private readonly windowSize: number;
  private readonly buffers = new Map<ProfilePhase, PhaseBuffer>();

  constructor(windowSize = 60) {
    this.windowSize = windowSize;
  }

  record(phase: ProfilePhase, durationMs: number): void {
    let buf = this.buffers.get(phase);
    if (!buf) {
      buf = { samples: new Float64Array(this.windowSize), writeIndex: 0, count: 0 };
      this.buffers.set(phase, buf);
    }
    buf.samples[buf.writeIndex % this.windowSize] = durationMs;
    buf.writeIndex = (buf.writeIndex + 1) % this.windowSize;
    if (buf.count < this.windowSize) {
      buf.count += 1;
    }
  }

  getStats(phase: ProfilePhase): { p50: number; p95: number; count: number; last: number } | null {
    const buf = this.buffers.get(phase);
    if (!buf || buf.count === 0) return null;

    // Copy valid portion and sort ascending
    const valid = buf.samples.slice(0, buf.count);
    const sorted = Array.from(valid).sort((a, b) => a - b);

    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    // last written sample is one position behind writeIndex
    const lastIndex = (buf.writeIndex - 1 + this.windowSize) % this.windowSize;
    const last = buf.samples[lastIndex];

    return { p50, p95, count: buf.count, last };
  }

  getAllStats(): Record<ProfilePhase, { p50: number; p95: number; count: number; last: number } | null> {
    const result = {} as Record<ProfilePhase, { p50: number; p95: number; count: number; last: number } | null>;
    for (const phase of ALL_PHASES) {
      result[phase] = this.getStats(phase);
    }
    return result;
  }

  reset(): void {
    this.buffers.clear();
  }
}

// ---------------------------------------------------------------------------
// Singleton instance — shared across the entire rendering pipeline
// ---------------------------------------------------------------------------
export const graphProfiler = new GraphProfiler();

// ---------------------------------------------------------------------------
// Synchronous timing wrapper for useMemo / pure-function call sites
// ---------------------------------------------------------------------------
export function profileSync<T>(phase: ProfilePhase, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  graphProfiler.record(phase, performance.now() - start);
  return result;
}

// ---------------------------------------------------------------------------
// Console API — call window.__graphMetrics() in Chrome DevTools
// ---------------------------------------------------------------------------
(window as any).__graphMetrics = () => {
  const stats = graphProfiler.getAllStats();
  const table: Record<string, { p50: string; p95: string; samples: number; last: string }> = {};
  for (const [phase, data] of Object.entries(stats)) {
    if (data) {
      table[phase] = {
        p50: `${data.p50.toFixed(2)}ms`,
        p95: `${data.p95.toFixed(2)}ms`,
        samples: data.count,
        last: `${data.last.toFixed(2)}ms`,
      };
    } else {
      table[phase] = { p50: '-', p95: '-', samples: 0, last: '-' };
    }
  }
  console.table(table);
  return stats;
};
