/**
 * ANSI escape code generation.
 * Converts cell changes to terminal output.
 */

import type { Cell, Color, Style } from "./cell.ts";
import { stylesEqual } from "./cell.ts";
import type { CellRun } from "./diff.ts";

// ANSI escape codes
const ESC = "\x1b";
const CSI = `${ESC}[`;

// Cursor movement
export function moveCursor(x: number, y: number): string {
  // ANSI uses 1-based coordinates
  return `${CSI}${y + 1};${x + 1}H`;
}

export function hideCursor(): string {
  return `${CSI}?25l`;
}

export function showCursor(): string {
  return `${CSI}?25h`;
}

export function clearScreen(): string {
  return `${CSI}2J${CSI}H`;
}

export function resetStyle(): string {
  return `${CSI}0m`;
}

// Color codes
const FG_COLORS: Record<string, number> = {
  default: 39,
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
};

const BG_COLORS: Record<string, number> = {
  default: 49,
  black: 40,
  red: 41,
  green: 42,
  yellow: 43,
  blue: 44,
  magenta: 45,
  cyan: 46,
  white: 47,
};

function colorToAnsi(color: Color, isFg: boolean): string {
  if (typeof color === "string") {
    const code = isFg ? FG_COLORS[color] : BG_COLORS[color];
    return code !== undefined ? `${CSI}${code}m` : "";
  }
  // RGB color
  const [r, g, b] = color.rgb;
  const mode = isFg ? 38 : 48;
  return `${CSI}${mode};2;${r};${g};${b}m`;
}

/**
 * Generate ANSI codes for a style.
 */
export function styleToAnsi(style: Style): string {
  const codes: string[] = [];

  if (style.bold) codes.push(`${CSI}1m`);
  if (style.dim) codes.push(`${CSI}2m`);
  if (style.italic) codes.push(`${CSI}3m`);
  if (style.underline) codes.push(`${CSI}4m`);
  if (style.inverse) codes.push(`${CSI}7m`);
  if (style.strikethrough) codes.push(`${CSI}9m`);
  if (style.color) codes.push(colorToAnsi(style.color, true));
  if (style.background) codes.push(colorToAnsi(style.background, false));

  return codes.join("");
}

/**
 * Render a single cell to ANSI.
 */
export function cellToAnsi(cell: Cell, prevStyle?: Style): string {
  // Reset + new style (could optimize to diff styles, but this is simpler)
  const styleCode = Object.keys(cell.style).length > 0
    ? resetStyle() + styleToAnsi(cell.style)
    : resetStyle();
  return styleCode + cell.char;
}

/**
 * Render a run of cells to ANSI.
 */
export function runToAnsi(run: CellRun): string {
  let output = moveCursor(run.x, run.y);

  let currentStyle: Style | null = null;

  for (const cell of run.cells) {
    // Check if style changed
    const styleChanged = !currentStyle || !stylesEqual(currentStyle, cell.style);

    if (styleChanged) {
      output += resetStyle();
      if (Object.keys(cell.style).length > 0) {
        output += styleToAnsi(cell.style);
      }
      currentStyle = cell.style;
    }

    output += cell.char;
  }

  return output;
}

/**
 * Render all runs to a single ANSI string.
 */
export function runsToAnsi(runs: CellRun[]): string {
  let output = "";

  for (const run of runs) {
    output += runToAnsi(run);
  }

  output += resetStyle();

  return output;
}
