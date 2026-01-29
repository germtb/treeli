/**
 * Layout props for flexbox-like positioning.
 */

import type { Style } from "./cell.ts";

export type Direction = "row" | "column";
export type Justify = "start" | "center" | "end" | "space-between" | "space-around";
export type Align = "start" | "center" | "end" | "stretch";
export type Position = "relative" | "absolute";
export type BorderStyle = "none" | "single" | "double" | "rounded" | "bold";

export interface Spacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutProps {
  // Flex properties
  direction?: Direction;
  justify?: Justify;
  align?: Align;
  gap?: number;

  // Spacing
  padding?: number | Partial<Spacing>;
  margin?: number | Partial<Spacing>;

  // Sizing
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;

  // Positioning
  position?: Position;
  x?: number;
  y?: number;
  zIndex?: number;

  // Appearance
  border?: BorderStyle | boolean;
  style?: Style;
}

/**
 * Normalize spacing value to full Spacing object.
 */
export function normalizeSpacing(value: number | Partial<Spacing> | undefined): Spacing {
  if (value === undefined) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  if (typeof value === "number") {
    return { top: value, right: value, bottom: value, left: value };
  }
  return {
    top: value.top ?? 0,
    right: value.right ?? 0,
    bottom: value.bottom ?? 0,
    left: value.left ?? 0,
  };
}

/**
 * Border characters for different styles.
 */
export const BORDER_CHARS = {
  single: {
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
  },
  double: {
    topLeft: "╔",
    topRight: "╗",
    bottomLeft: "╚",
    bottomRight: "╝",
    horizontal: "═",
    vertical: "║",
  },
  rounded: {
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "─",
    vertical: "│",
  },
  bold: {
    topLeft: "┏",
    topRight: "┓",
    bottomLeft: "┗",
    bottomRight: "┛",
    horizontal: "━",
    vertical: "┃",
  },
} as const;

export function getBorderStyle(border: BorderStyle | boolean | undefined): BorderStyle {
  if (border === undefined || border === false || border === "none") {
    return "none";
  }
  if (border === true) {
    return "single";
  }
  return border;
}
