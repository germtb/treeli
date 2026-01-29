/**
 * Renderer: the main orchestrator that ties everything together.
 * Uses LogicalBuffer for content storage, transforms to visual rows for output.
 */

import { LogicalBuffer } from "./logical-buffer.ts";
import { CellBuffer } from "./buffer.ts";
import { diffBuffers, findRuns } from "./diff.ts";
import { computeLayout, renderToLogicalBuffer } from "./layout.ts";
import { runsToAnsi, clearScreen } from "./ansi.ts";
import type { VNode } from "./vnode.ts";
import { EMPTY_CELL } from "./cell.ts";

export interface RendererOptions {
  width: number;
  height: number;
  output?: (str: string) => void;
}

export class Renderer {
  private width: number;
  private height: number;
  private currentLogical: LogicalBuffer;
  private nextLogical: LogicalBuffer;
  // Visual buffers for diffing (what's actually on screen)
  private currentVisual: CellBuffer;
  private nextVisual: CellBuffer;
  private output: (str: string) => void;
  private isFirstRender = true;

  constructor(options: RendererOptions) {
    this.width = options.width;
    this.height = options.height;
    // Logical buffers can have more rows than terminal height
    // to accommodate wrapped content
    this.currentLogical = new LogicalBuffer(this.height);
    this.nextLogical = new LogicalBuffer(this.height);
    // Visual buffers match terminal dimensions
    this.currentVisual = new CellBuffer(this.width, this.height);
    this.nextVisual = new CellBuffer(this.width, this.height);
    this.output = options.output ?? ((s) => process.stdout.write(s));
  }

  /**
   * Render a VNode tree to the terminal.
   */
  render(root: VNode): void {
    // Clear next logical buffer
    this.nextLogical.clear();

    // Compute layout with terminal width for proper box sizing
    // Text can still extend beyond - LogicalBuffer handles it
    const layoutContext = {
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
    };
    const layout = computeLayout(root, layoutContext);

    // Render to logical buffer
    renderToLogicalBuffer(layout, this.nextLogical);

    // Fill nextVisual with spaces - create unique cells for each position
    // to ensure diff can detect when positions need clearing
    this.nextVisual.clear();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.nextVisual.set(x, y, { char: " ", style: {} });
      }
    }

    const { visualRows, logicalToVisual } = this.nextLogical.toVisualRows(this.width);

    // Copy visual rows to visual buffer (up to terminal height)
    for (let vy = 0; vy < Math.min(visualRows.length, this.height); vy++) {
      const row = visualRows[vy]!;
      for (let x = 0; x < row.length; x++) {
        this.nextVisual.set(x, vy, row[x]!);
      }
    }

    // Diff and output
    if (this.isFirstRender) {
      this.output(clearScreen());
      this.isFirstRender = false;
    }

    const changes = diffBuffers(this.currentVisual, this.nextVisual);

    if (changes.length > 0) {
      const runs = findRuns(changes);
      const ansi = runsToAnsi(runs);
      this.output(ansi);
    }

    // Swap buffers
    const tempLogical = this.currentLogical;
    this.currentLogical = this.nextLogical;
    this.nextLogical = tempLogical;

    const tempVisual = this.currentVisual;
    this.currentVisual = this.nextVisual;
    this.nextVisual = tempVisual;
  }

  /**
   * Force a full redraw.
   */
  forceRedraw(): void {
    this.isFirstRender = true;
    this.currentLogical.clear();
    this.currentVisual.clear();
  }

  /**
   * Resize the renderer.
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.currentLogical = new LogicalBuffer(height);
    this.nextLogical = new LogicalBuffer(height);
    this.currentVisual = new CellBuffer(width, height);
    this.nextVisual = new CellBuffer(width, height);
    this.isFirstRender = true;
  }

  /**
   * Get the current visual buffer (for testing).
   */
  getCurrentBuffer(): CellBuffer {
    return this.currentVisual;
  }

  /**
   * Get terminal width.
   */
  getWidth(): number {
    return this.width;
  }

  /**
   * Get terminal height.
   */
  getHeight(): number {
    return this.height;
  }
}
