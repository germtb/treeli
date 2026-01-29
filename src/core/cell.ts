/**
 * A Cell represents a single "pixel" in the terminal.
 * It holds a character and its styling attributes.
 */

export type Color =
  | "default"
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | { rgb: readonly [number, number, number] };

export interface Style {
  color?: Color;
  background?: Color;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  strikethrough?: boolean;
}

export interface Cell {
  char: string; // Single character (or empty for transparent)
  style: Style;
}

export const EMPTY_STYLE: Style = {};

export const EMPTY_CELL: Cell = {
  char: " ",
  style: EMPTY_STYLE,
};

export function createCell(char: string, style: Style = EMPTY_STYLE): Cell {
  return { char: char[0] ?? " ", style };
}

export function cellsEqual(a: Cell, b: Cell): boolean {
  if (a.char !== b.char) return false;
  return stylesEqual(a.style, b.style);
}

export function stylesEqual(a: Style, b: Style): boolean {
  if (a.bold !== b.bold) return false;
  if (a.dim !== b.dim) return false;
  if (a.italic !== b.italic) return false;
  if (a.underline !== b.underline) return false;
  if (a.inverse !== b.inverse) return false;
  if (a.strikethrough !== b.strikethrough) return false;
  if (!colorsEqual(a.color, b.color)) return false;
  if (!colorsEqual(a.background, b.background)) return false;
  return true;
}

export function colorsEqual(a: Color | undefined, b: Color | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  if (typeof a === "string" || typeof b === "string") return false;
  return a.rgb[0] === b.rgb[0] && a.rgb[1] === b.rgb[1] && a.rgb[2] === b.rgb[2];
}
