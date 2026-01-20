export type Rect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export class SpatialIndex<T> {
  private readonly cellSize: number;
  private readonly cells = new Map<string, Set<T>>();
  private readonly items = new Map<T, Rect>();

  constructor(cellSize: number) {
    this.cellSize = Math.max(1, cellSize);
  }

  clear() {
    this.cells.clear();
    this.items.clear();
  }

  insert(id: T, rect: Rect) {
    this.items.set(id, rect);
    this.addToCells(id, rect);
  }

  update(id: T, rect: Rect) {
    const prev = this.items.get(id);
    if (prev) {
      this.removeFromCells(id, prev);
    }
    this.items.set(id, rect);
    this.addToCells(id, rect);
  }

  remove(id: T) {
    const rect = this.items.get(id);
    if (!rect) return;
    this.removeFromCells(id, rect);
    this.items.delete(id);
  }

  query(rect: Rect): Set<T> {
    const hits = new Set<T>();
    const { minCol, maxCol, minRow, maxRow } = this.getCellRange(rect);
    for (let col = minCol; col <= maxCol; col += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        const key = `${col},${row}`;
        const cell = this.cells.get(key);
        if (!cell) continue;
        cell.forEach((id) => {
          const itemRect = this.items.get(id);
          if (!itemRect) return;
          if (!intersects(itemRect, rect)) return;
          hits.add(id);
        });
      }
    }
    return hits;
  }

  private addToCells(id: T, rect: Rect) {
    const { minCol, maxCol, minRow, maxRow } = this.getCellRange(rect);
    for (let col = minCol; col <= maxCol; col += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        const key = `${col},${row}`;
        let cell = this.cells.get(key);
        if (!cell) {
          cell = new Set();
          this.cells.set(key, cell);
        }
        cell.add(id);
      }
    }
  }

  private removeFromCells(id: T, rect: Rect) {
    const { minCol, maxCol, minRow, maxRow } = this.getCellRange(rect);
    for (let col = minCol; col <= maxCol; col += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        const key = `${col},${row}`;
        const cell = this.cells.get(key);
        if (!cell) continue;
        cell.delete(id);
        if (cell.size === 0) this.cells.delete(key);
      }
    }
  }

  private getCellRange(rect: Rect) {
    const minCol = Math.floor(rect.minX / this.cellSize);
    const maxCol = Math.floor(rect.maxX / this.cellSize);
    const minRow = Math.floor(rect.minY / this.cellSize);
    const maxRow = Math.floor(rect.maxY / this.cellSize);
    return { minCol, maxCol, minRow, maxRow };
  }
}

function intersects(a: Rect, b: Rect): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

