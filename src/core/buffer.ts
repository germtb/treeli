/**
 * CellBuffer is the 2D matrix that represents the terminal screen.
 * This is the core data structure for our diffing approach.
 */

import { type Cell, EMPTY_CELL, cellsEqual, type Style } from "./cell.ts";

export class CellBuffer {
  readonly width: number;
  readonly height: number;
  private cells: Cell[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height).fill(EMPTY_CELL);
  }

  private index(x: number, y: number): number {
    return y * this.width + x;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  get(x: number, y: number): Cell {
    if (!this.inBounds(x, y)) return EMPTY_CELL;
    return this.cells[this.index(x, y)] ?? EMPTY_CELL;
  }

  set(x: number, y: number, cell: Cell): void {
    if (!this.inBounds(x, y)) return;
    this.cells[this.index(x, y)] = cell;
  }

  setChar(x: number, y: number, char: string, style: Style = {}): void {
    this.set(x, y, { char, style });
  }

  /**
   * Set a character, merging style with existing cell's style.
   * This preserves background if the new style doesn't specify one.
   */
  setCharMerge(x: number, y: number, char: string, style: Style = {}): void {
    if (!this.inBounds(x, y)) return;
    const existing = this.get(x, y);
    const mergedStyle: Style = {
      ...existing.style,
      ...style,
    };
    // Only override background if new style has it
    if (style.background === undefined && existing.style.background !== undefined) {
      mergedStyle.background = existing.style.background;
    }
    this.set(x, y, { char, style: mergedStyle });
  }

  /**
   * Write a string starting at (x, y), going right.
   * Text is clipped at buffer edge.
   */
  writeString(x: number, y: number, text: string, style: Style = {}): number {
    if (y < 0 || y >= this.height) return 0;

    let written = 0;
    for (let i = 0; i < text.length; i++) {
      const col = x + i;
      if (col < 0) continue;
      if (col >= this.width) break;

      this.setChar(col, y, text[i]!, style);
      written++;
    }
    return written;
  }

  /**
   * Write a string, merging style with existing cells.
   * Text is clipped at buffer edge.
   */
  writeStringMerge(x: number, y: number, text: string, style: Style = {}): number {
    if (y < 0 || y >= this.height) return 0;

    let written = 0;
    for (let i = 0; i < text.length; i++) {
      const col = x + i;
      if (col < 0) continue;
      if (col >= this.width) break;

      this.setCharMerge(col, y, text[i]!, style);
      written++;
    }
    return written;
  }

  /**
   * Fill a rectangular region with a cell.
   */
  fillRect(x: number, y: number, width: number, height: number, cell: Cell): void {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.set(x + dx, y + dy, cell);
      }
    }
  }

  /**
   * Clear the entire buffer.
   */
  clear(): void {
    this.cells.fill(EMPTY_CELL);
  }

  /**
   * Copy contents from another buffer into this one at position (destX, destY).
   */
  blit(source: CellBuffer, destX: number, destY: number): void {
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        const cell = source.get(x, y);
        this.set(destX + x, destY + y, cell);
      }
    }
  }

  /**
   * Create a clone of this buffer.
   */
  clone(): CellBuffer {
    const copy = new CellBuffer(this.width, this.height);
    copy.cells = [...this.cells];
    return copy;
  }

  /**
   * Check if this buffer equals another.
   */
  equals(other: CellBuffer): boolean {
    if (this.width !== other.width || this.height !== other.height) {
      return false;
    }
    for (let i = 0; i < this.cells.length; i++) {
      if (!cellsEqual(this.cells[i]!, other.cells[i]!)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get a debug string representation.
   */
  toDebugString(): string {
    const lines: string[] = [];
    for (let y = 0; y < this.height; y++) {
      let line = "";
      for (let x = 0; x < this.width; x++) {
        line += this.get(x, y).char;
      }
      lines.push(line);
    }
    return lines.join("\n");
  }
}
