/**
 * LogicalBuffer: A buffer where each row can have arbitrary length.
 * This is the core abstraction for content that may wrap at terminal edges.
 */

import { type Cell, EMPTY_CELL, cellsEqual, type Style } from "./cell.ts";

/**
 * A logical row is a variable-length array of cells.
 */
export interface LogicalRow {
  cells: Cell[];
}

/**
 * LogicalBuffer stores content as logical rows (arbitrary length).
 * Terminal wrapping is handled at render time, not storage time.
 */
export class LogicalBuffer {
  private rows: LogicalRow[];
  readonly height: number; // Max logical rows

  constructor(height: number) {
    this.height = height;
    this.rows = [];
    for (let i = 0; i < height; i++) {
      this.rows.push({ cells: [] });
    }
  }

  /**
   * Get a cell at logical position (x, y).
   * Returns EMPTY_CELL if out of bounds.
   */
  get(x: number, y: number): Cell {
    if (y < 0 || y >= this.height) return EMPTY_CELL;
    const row = this.rows[y];
    if (!row || x < 0 || x >= row.cells.length) return EMPTY_CELL;
    return row.cells[x] ?? EMPTY_CELL;
  }

  /**
   * Set a cell at logical position (x, y).
   * Extends the row if needed.
   */
  set(x: number, y: number, cell: Cell): void {
    if (y < 0 || y >= this.height || x < 0) return;
    const row = this.rows[y]!;

    // Extend row with empty cells if needed
    while (row.cells.length <= x) {
      row.cells.push(EMPTY_CELL);
    }
    row.cells[x] = cell;
  }

  /**
   * Set a cell at logical position (x, y), merging style with existing cell.
   * Preserves background color if the new style doesn't specify one.
   */
  setMerge(x: number, y: number, cell: Cell): void {
    if (y < 0 || y >= this.height || x < 0) return;
    const row = this.rows[y]!;

    // Extend row with empty cells if needed
    while (row.cells.length <= x) {
      row.cells.push(EMPTY_CELL);
    }

    const existing = row.cells[x] ?? EMPTY_CELL;
    const mergedStyle: Style = {
      ...existing.style,
      ...cell.style,
    };
    // Preserve background if new style doesn't specify one
    if (cell.style.background === undefined && existing.style.background !== undefined) {
      mergedStyle.background = existing.style.background;
    }
    row.cells[x] = { char: cell.char, style: mergedStyle };
  }

  /**
   * Get the length of a logical row.
   */
  rowLength(y: number): number {
    if (y < 0 || y >= this.height) return 0;
    return this.rows[y]?.cells.length ?? 0;
  }

  /**
   * Get a logical row.
   */
  getRow(y: number): LogicalRow | undefined {
    if (y < 0 || y >= this.height) return undefined;
    return this.rows[y];
  }

  /**
   * Write a string starting at (x, y).
   * The row extends as needed - no clipping.
   */
  writeString(x: number, y: number, text: string, style: Style = {}): void {
    if (y < 0 || y >= this.height) return;

    for (let i = 0; i < text.length; i++) {
      this.set(x + i, y, { char: text[i]!, style });
    }
  }

  /**
   * Write a string, merging style with existing cells.
   */
  writeStringMerge(x: number, y: number, text: string, style: Style = {}): void {
    if (y < 0 || y >= this.height) return;

    for (let i = 0; i < text.length; i++) {
      const col = x + i;
      if (col < 0) continue;

      const existing = this.get(col, y);
      const mergedStyle: Style = {
        ...existing.style,
        ...style,
      };
      // Preserve background if new style doesn't specify one
      if (style.background === undefined && existing.style.background !== undefined) {
        mergedStyle.background = existing.style.background;
      }
      this.set(col, y, { char: text[i]!, style: mergedStyle });
    }
  }

  /**
   * Clear a row.
   */
  clearRow(y: number): void {
    if (y < 0 || y >= this.height) return;
    this.rows[y] = { cells: [] };
  }

  /**
   * Clear the entire buffer.
   */
  clear(): void {
    for (let y = 0; y < this.height; y++) {
      this.rows[y] = { cells: [] };
    }
  }

  /**
   * Transform logical rows to visual rows based on terminal width.
   * Returns an array of visual rows and a mapping from logical row to starting visual row.
   */
  toVisualRows(terminalWidth: number): {
    visualRows: Cell[][];
    logicalToVisual: number[]; // logicalToVisual[logicalY] = first visual row index
  } {
    const visualRows: Cell[][] = [];
    const logicalToVisual: number[] = [];

    for (let y = 0; y < this.height; y++) {
      logicalToVisual[y] = visualRows.length;

      const row = this.rows[y]!;
      if (row.cells.length === 0) {
        // Empty logical row = one empty visual row
        visualRows.push([]);
      } else {
        // Split into chunks of terminalWidth
        for (let i = 0; i < row.cells.length; i += terminalWidth) {
          visualRows.push(row.cells.slice(i, i + terminalWidth));
        }
      }
    }

    return { visualRows, logicalToVisual };
  }

  /**
   * Check if two logical buffers are equal.
   */
  equals(other: LogicalBuffer): boolean {
    if (this.height !== other.height) return false;

    for (let y = 0; y < this.height; y++) {
      const thisRow = this.rows[y]!;
      const otherRow = other.rows[y]!;

      if (thisRow.cells.length !== otherRow.cells.length) return false;

      for (let x = 0; x < thisRow.cells.length; x++) {
        if (!cellsEqual(thisRow.cells[x]!, otherRow.cells[x]!)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Clone this buffer.
   */
  clone(): LogicalBuffer {
    const copy = new LogicalBuffer(this.height);
    for (let y = 0; y < this.height; y++) {
      copy.rows[y] = { cells: [...this.rows[y]!.cells] };
    }
    return copy;
  }

  /**
   * Debug string representation.
   */
  toDebugString(): string {
    const lines: string[] = [];
    for (let y = 0; y < this.height; y++) {
      const row = this.rows[y]!;
      lines.push(row.cells.map(c => c.char).join(""));
    }
    return lines.join("\n");
  }
}
