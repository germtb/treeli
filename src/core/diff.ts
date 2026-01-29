/**
 * Diff engine: compares two CellBuffers and produces a minimal set of changes.
 */

import { CellBuffer } from "./buffer.ts";
import { type Cell, cellsEqual } from "./cell.ts";

export interface CellChange {
  x: number;
  y: number;
  cell: Cell;
}

/**
 * Compute the diff between two buffers.
 * Returns an array of cell changes needed to transform `from` into `to`.
 */
export function diffBuffers(from: CellBuffer, to: CellBuffer): CellChange[] {
  const changes: CellChange[] = [];

  // If dimensions differ, we need a full redraw
  // In practice, you'd handle terminal resize separately
  const width = Math.min(from.width, to.width);
  const height = Math.min(from.height, to.height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const fromCell = from.get(x, y);
      const toCell = to.get(x, y);

      if (!cellsEqual(fromCell, toCell)) {
        changes.push({ x, y, cell: toCell });
      }
    }
  }

  // Handle case where `to` is larger
  for (let y = 0; y < to.height; y++) {
    for (let x = 0; x < to.width; x++) {
      if (x >= width || y >= height) {
        changes.push({ x, y, cell: to.get(x, y) });
      }
    }
  }

  return changes;
}

/**
 * Group changes by row for more efficient cursor movement.
 * Returns changes grouped by y-coordinate.
 */
export function groupChangesByRow(changes: CellChange[]): Map<number, CellChange[]> {
  const byRow = new Map<number, CellChange[]>();

  for (const change of changes) {
    let row = byRow.get(change.y);
    if (!row) {
      row = [];
      byRow.set(change.y, row);
    }
    row.push(change);
  }

  // Sort each row by x coordinate
  for (const row of byRow.values()) {
    row.sort((a, b) => a.x - b.x);
  }

  return byRow;
}

/**
 * Detect consecutive runs in a row for even more efficient output.
 * A run is a sequence of consecutive x positions.
 */
export interface CellRun {
  x: number;
  y: number;
  cells: Cell[];
}

export function findRuns(changes: CellChange[]): CellRun[] {
  if (changes.length === 0) return [];

  const byRow = groupChangesByRow(changes);
  const runs: CellRun[] = [];

  for (const [y, rowChanges] of byRow) {
    let currentRun: CellRun | null = null;

    for (const change of rowChanges) {
      if (currentRun && change.x === currentRun.x + currentRun.cells.length) {
        // Consecutive: extend the run
        currentRun.cells.push(change.cell);
      } else {
        // Start a new run
        if (currentRun) runs.push(currentRun);
        currentRun = { x: change.x, y, cells: [change.cell] };
      }
    }

    if (currentRun) runs.push(currentRun);
  }

  return runs;
}
