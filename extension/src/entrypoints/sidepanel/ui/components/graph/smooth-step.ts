import type { ConnectionSegment } from '../../graph/render/types.js';

type Point = { x: number; y: number };
type Position = 'top' | 'bottom' | 'left' | 'right';

const OFFSET = 20;

const handleDirections: Record<Position, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

function getDirection(source: Point, sourcePosition: Position, target: Point): Point {
  if (sourcePosition === 'left' || sourcePosition === 'right') {
    return source.x < target.x ? { x: 1, y: 0 } : { x: -1, y: 0 };
  }
  return source.y < target.y ? { x: 0, y: 1 } : { x: 0, y: -1 };
}

/**
 * Port of xyflow's getPoints — computes waypoints for a smooth-step path.
 * Returns an array of points: [source, sourceGapped, ...waypoints, targetGapped, target]
 */
function getPoints(
  source: Point,
  sourcePosition: Position,
  target: Point,
  targetPosition: Position,
  center?: { x?: number; y?: number },
): Point[] {
  const sourceDir = handleDirections[sourcePosition];
  const targetDir = handleDirections[targetPosition];
  const sourceGapped: Point = {
    x: source.x + sourceDir.x * OFFSET,
    y: source.y + sourceDir.y * OFFSET,
  };
  const targetGapped: Point = {
    x: target.x + targetDir.x * OFFSET,
    y: target.y + targetDir.y * OFFSET,
  };

  const dir = getDirection(sourceGapped, sourcePosition, targetGapped);
  const dirAccessor: 'x' | 'y' = dir.x !== 0 ? 'x' : 'y';
  const currDir = dir[dirAccessor];

  let points: Point[];
  const sourceGapOffset: Point = { x: 0, y: 0 };
  const targetGapOffset: Point = { x: 0, y: 0 };

  // Opposite handle positions (e.g. Bottom→Top, Right→Left)
  if (sourceDir[dirAccessor] * targetDir[dirAccessor] === -1) {
    const midX = center?.x ?? (sourceGapped.x + targetGapped.x) / 2;
    const midY = center?.y ?? (sourceGapped.y + targetGapped.y) / 2;
    const verticalSplit: Point[] = [
      { x: midX, y: sourceGapped.y },
      { x: midX, y: targetGapped.y },
    ];
    const horizontalSplit: Point[] = [
      { x: sourceGapped.x, y: midY },
      { x: targetGapped.x, y: midY },
    ];

    if (sourceDir[dirAccessor] === currDir) {
      points = dirAccessor === 'x' ? verticalSplit : horizontalSplit;
    } else {
      points = dirAccessor === 'x' ? horizontalSplit : verticalSplit;
    }
  } else {
    // Same or mixed handle positions
    const sourceTarget: Point[] = [{ x: sourceGapped.x, y: targetGapped.y }];
    const targetSource: Point[] = [{ x: targetGapped.x, y: sourceGapped.y }];

    if (dirAccessor === 'x') {
      points = sourceDir.x === currDir ? targetSource : sourceTarget;
    } else {
      points = sourceDir.y === currDir ? sourceTarget : targetSource;
    }

    // Same handle positions: fix overlap when source/target are close
    if (sourcePosition === targetPosition) {
      const diff = Math.abs(source[dirAccessor] - target[dirAccessor]);
      if (diff <= OFFSET) {
        const gapOffset = Math.min(OFFSET - 1, OFFSET - diff);
        if (sourceDir[dirAccessor] === currDir) {
          sourceGapOffset[dirAccessor] =
            (sourceGapped[dirAccessor] > source[dirAccessor] ? -1 : 1) * gapOffset;
        } else {
          targetGapOffset[dirAccessor] =
            (targetGapped[dirAccessor] > target[dirAccessor] ? -1 : 1) * gapOffset;
        }
      }
    }

    // Mixed handle positions (e.g. Right→Bottom): conditional flip
    if (sourcePosition !== targetPosition) {
      const dirOpp: 'x' | 'y' = dirAccessor === 'x' ? 'y' : 'x';
      const isSameDir = sourceDir[dirAccessor] === targetDir[dirOpp];
      const sourceGtTarget = sourceGapped[dirOpp] > targetGapped[dirOpp];
      const sourceLtTarget = sourceGapped[dirOpp] < targetGapped[dirOpp];
      const flipSourceTarget =
        (sourceDir[dirAccessor] === 1 &&
          ((!isSameDir && sourceGtTarget) || (isSameDir && sourceLtTarget))) ||
        (sourceDir[dirAccessor] !== 1 &&
          ((!isSameDir && sourceLtTarget) || (isSameDir && sourceGtTarget)));

      if (flipSourceTarget) {
        points = dirAccessor === 'x' ? sourceTarget : targetSource;
      }
    }
  }

  return [
    source,
    { x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y },
    ...points,
    { x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y },
    target,
  ];
}

function simplifyPath(raw: Point[]): Point[] {
  if (raw.length <= 2) return raw;
  const result: Point[] = [raw[0]!];
  for (let i = 1; i < raw.length; i++) {
    const prev = result[result.length - 1]!;
    const curr = raw[i]!;
    if (Math.abs(curr.x - prev.x) < 0.5 && Math.abs(curr.y - prev.y) < 0.5) continue;
    if (result.length >= 2) {
      const pp = result[result.length - 2]!;
      const collinearX = Math.abs(pp.x - prev.x) < 0.5 && Math.abs(prev.x - curr.x) < 0.5;
      const collinearY = Math.abs(pp.y - prev.y) < 0.5 && Math.abs(prev.y - curr.y) < 0.5;
      if (collinearX || collinearY) {
        result[result.length - 1] = curr;
        continue;
      }
    }
    result.push(curr);
  }
  return result;
}

function computeBounds(points: Point[]): ConnectionSegment['bounds'] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function buildSmoothStepSegment(
  id: string,
  source: Point,
  sourcePosition: Position,
  target: Point,
  targetPosition: Position,
  onPath: boolean,
  center?: { x?: number; y?: number },
): ConnectionSegment {
  const points = simplifyPath(getPoints(source, sourcePosition, target, targetPosition, center));
  return {
    id,
    points,
    onPath,
    style: 'smoothstep',
    bounds: computeBounds(points),
  };
}
