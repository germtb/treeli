/**
 * Flex layout engine.
 * Computes positions and sizes for a VNode tree using flexbox-like rules.
 */

import { CellBuffer } from "./buffer.ts";
import { LogicalBuffer } from "./logical-buffer.ts";
import {
  type VNode,
  isTextNode,
  getTextContent,
  expandNode,
  TEXT_NODE_TYPE,
} from "./vnode.ts";
import { createCell, type Style } from "./cell.ts";
import {
  normalizeSpacing,
  getBorderStyle,
  BORDER_CHARS,
  type Spacing,
  type Direction,
  type Justify,
  type Align,
  type BorderStyle,
  type Overflow,
} from "./props.ts";
import type { Input } from "./input.ts";
import type { Select } from "./select.ts";

/**
 * Clip region for overflow handling.
 * Content outside this region will be clipped.
 */
export interface ClipRegion {
  minX: number;
  minY: number;
  maxX: number; // exclusive
  maxY: number; // exclusive
}

export interface LayoutBox {
  // Position (absolute, after all calculations)
  x: number;
  y: number;
  width: number;
  height: number;

  // Content area (inside padding/border)
  innerX: number;
  innerY: number;
  innerWidth: number;
  innerHeight: number;

  // The node this box represents
  node: VNode;

  // Child boxes
  children: LayoutBox[];

  // For z-index sorting
  zIndex: number;
}

export interface LayoutContext {
  // Available space
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  box: LayoutBox;
  // Absolute positioned elements collected during layout
  absoluteBoxes: LayoutBox[];
}

/**
 * Compute layout for a VNode tree.
 */
export function computeLayout(
  node: VNode,
  context: LayoutContext
): LayoutBox {
  // First expand any functional components
  const expanded = expandNode(node);

  // Layout the tree
  const result = layoutNode(expanded, context);

  // Merge absolute boxes back, sorted by z-index
  const allAbsolute = collectAbsoluteBoxes(result.box);
  allAbsolute.push(...result.absoluteBoxes);
  allAbsolute.sort((a, b) => a.zIndex - b.zIndex);

  // Return root with absolute boxes as additional children for rendering
  return {
    ...result.box,
    children: [...result.box.children, ...allAbsolute],
  };
}

function collectAbsoluteBoxes(box: LayoutBox): LayoutBox[] {
  const result: LayoutBox[] = [];
  for (const child of box.children) {
    if (child.node.props.position === "absolute") {
      result.push(child);
    }
    result.push(...collectAbsoluteBoxes(child));
  }
  return result;
}

/**
 * Measure the natural size of a node (before flex distribution).
 */
function measureNode(node: VNode): { width: number; height: number } {
  // Text nodes: width = text length, height = 1
  if (isTextNode(node)) {
    const text = getTextContent(node);
    const lines = text.split("\n");
    const maxLineWidth = Math.max(...lines.map(l => l.length), 0);
    return { width: maxLineWidth, height: lines.length };
  }

  // <text> element: collect all child text
  if (node.type === "text") {
    const text = collectTextContent(node);
    const lines = text.split("\n");
    const maxLineWidth = Math.max(...lines.map(l => l.length), 0);
    return { width: maxLineWidth, height: lines.length };
  }

  // <input> element: size based on content (with room for cursor)
  if (node.type === "input") {
    const input = node.props.input as Input;
    const explicitWidth = node.props.width as number | undefined;
    const explicitHeight = node.props.height as number | undefined;
    const displayValue = input.displayValue();

    // Measure content
    const lines = displayValue.split("\n");
    const maxLineWidth = Math.max(...lines.map(l => l.length), 0);

    // Add 1 to width to always have room for cursor at end of line
    const width = explicitWidth ?? (maxLineWidth + 1);
    const height = explicitHeight ?? lines.length;

    return { width, height };
  }

  // <select> element: size based on options and pointer
  if (node.type === "select") {
    const pointerWidth = (node.props.pointerWidth as number) ?? 2;
    const optionChildren = node.children.filter((c) => c.type === "option");

    // Measure each option
    let maxOptionWidth = 0;
    for (const opt of optionChildren) {
      const optText = collectTextContent(opt);
      maxOptionWidth = Math.max(maxOptionWidth, optText.length);
    }

    const width = pointerWidth + maxOptionWidth;
    const height = optionChildren.length;

    return { width, height };
  }

  // For boxes, we need to measure children
  const padding = normalizeSpacing(node.props.padding as any);
  const border = getBorderStyle(node.props.border as any);
  const borderSize = border !== "none" ? 1 : 0;

  const direction = (node.props.direction as Direction) ?? "column";
  const gap = (node.props.gap as number) ?? 0;

  let contentWidth = 0;
  let contentHeight = 0;

  const childSizes = node.children
    .filter((c) => c.props.position !== "absolute")
    .map((c) => measureNode(c));

  if (direction === "row") {
    // Row: width is sum, height is max
    for (let i = 0; i < childSizes.length; i++) {
      contentWidth += childSizes[i]!.width;
      if (i > 0) contentWidth += gap;
      contentHeight = Math.max(contentHeight, childSizes[i]!.height);
    }
  } else {
    // Column: width is max, height is sum
    for (let i = 0; i < childSizes.length; i++) {
      contentHeight += childSizes[i]!.height;
      if (i > 0) contentHeight += gap;
      contentWidth = Math.max(contentWidth, childSizes[i]!.width);
    }
  }

  // Add padding and border
  const totalWidth =
    contentWidth + padding.left + padding.right + borderSize * 2;
  const totalHeight =
    contentHeight + padding.top + padding.bottom + borderSize * 2;

  // Apply explicit size constraints
  const explicitWidth = node.props.width as number | undefined;
  const explicitHeight = node.props.height as number | undefined;
  const minWidth = (node.props.minWidth as number) ?? 0;
  const minHeight = (node.props.minHeight as number) ?? 0;

  return {
    width: Math.max(minWidth, explicitWidth ?? totalWidth),
    height: Math.max(minHeight, explicitHeight ?? totalHeight),
  };
}

function layoutNode(node: VNode, ctx: LayoutContext): LayoutResult {
  const absoluteBoxes: LayoutBox[] = [];

  // Handle fragments: just layout children in sequence (column-like)
  if (node.type === "fragment") {
    return layoutFragment(node, ctx);
  }

  // Handle text nodes
  if (isTextNode(node)) {
    const text = getTextContent(node);
    const lines = text.split("\n");
    const maxLineWidth = Math.max(...lines.map(l => l.length), 0);

    return {
      box: {
        x: ctx.x,
        y: ctx.y,
        width: Math.min(maxLineWidth, ctx.width),
        height: lines.length,
        innerX: ctx.x,
        innerY: ctx.y,
        innerWidth: Math.min(maxLineWidth, ctx.width),
        innerHeight: lines.length,
        node,
        children: [],
        zIndex: (node.props.zIndex as number) ?? 0,
      },
      absoluteBoxes: [],
    };
  }

  // Handle <text> element - splits on newlines (with optional wrap)
  if (node.type === "text") {
    const text = collectTextContent(node);
    const shouldWrap = node.props.wrap === true;

    // If wrapping is enabled, wrap to context width
    const lines = shouldWrap ? wrapText(text, ctx.width) : text.split("\n");
    const maxLineWidth = Math.max(...lines.map(l => l.length), 0);

    // Create synthetic node with the wrapped text stored in props
    const syntheticNode: VNode = {
      type: TEXT_NODE_TYPE,
      props: {
        text: lines.join("\n"), // Store wrapped text
        style: node.props.style,
      },
      children: [],
      hash: node.hash + "_text",
    };

    return {
      box: {
        x: ctx.x,
        y: ctx.y,
        width: Math.min(maxLineWidth, ctx.width),
        height: lines.length,
        innerX: ctx.x,
        innerY: ctx.y,
        innerWidth: Math.min(maxLineWidth, ctx.width),
        innerHeight: lines.length,
        node: syntheticNode,
        children: [],
        zIndex: (node.props.zIndex as number) ?? 0,
      },
      absoluteBoxes: [],
    };
  }

  // Handle <input> element - sizes based on content (with room for cursor)
  if (node.type === "input") {
    const input = node.props.input as Input;
    const explicitWidth = node.props.width as number | undefined;
    const explicitHeight = node.props.height as number | undefined;
    const displayValue = input.displayValue();

    // Measure content
    const lines = displayValue.split("\n");
    const maxLineWidth = Math.max(...lines.map(l => l.length), 0);

    // Add 1 to width to always have room for cursor at end of line
    const width = explicitWidth ?? (maxLineWidth + 1);
    const height = explicitHeight ?? lines.length;

    return {
      box: {
        x: ctx.x,
        y: ctx.y,
        width,
        height,
        innerX: ctx.x,
        innerY: ctx.y,
        innerWidth: width,
        innerHeight: height,
        node,
        children: [],
        zIndex: (node.props.zIndex as number) ?? 0,
      },
      absoluteBoxes: [],
    };
  }

  // Handle <select> element - creates layout for options with pointer
  if (node.type === "select") {
    const select = node.props.select as Select<unknown>;
    const pointerWidth = (node.props.pointerWidth as number) ?? 2;
    const optionChildren = node.children.filter((c) => c.type === "option");

    // Register options with the select primitive
    select._clearOptions();
    optionChildren.forEach((opt, index) => {
      select._registerOption(index, opt.props.value);
    });
    select._setOptionCount(optionChildren.length);

    // Measure total size
    let maxOptionWidth = 0;
    for (const opt of optionChildren) {
      const optText = collectTextContent(opt);
      maxOptionWidth = Math.max(maxOptionWidth, optText.length);
    }

    const totalWidth = pointerWidth + maxOptionWidth;
    const totalHeight = optionChildren.length;

    return {
      box: {
        x: ctx.x,
        y: ctx.y,
        width: totalWidth,
        height: totalHeight,
        innerX: ctx.x,
        innerY: ctx.y,
        innerWidth: totalWidth,
        innerHeight: totalHeight,
        node,
        children: [], // Options are rendered directly, not as child boxes
        zIndex: (node.props.zIndex as number) ?? 0,
      },
      absoluteBoxes: [],
    };
  }

  // It's a box element - apply flex layout
  const padding = normalizeSpacing(node.props.padding as any);
  const margin = normalizeSpacing(node.props.margin as any);
  const border = getBorderStyle(node.props.border as any);
  const borderSize = border !== "none" ? 1 : 0;

  const direction = (node.props.direction as Direction) ?? "column";
  const justify = (node.props.justify as Justify) ?? "start";
  const align = (node.props.align as Align) ?? "start";
  const gap = (node.props.gap as number) ?? 0;

  // Calculate box dimensions
  const measured = measureNode(node);
  const boxWidth = (node.props.width as number) ?? Math.min(measured.width, ctx.width - margin.left - margin.right);
  const boxHeight = (node.props.height as number) ?? measured.height;

  // Box position (respecting margin)
  const boxX = ctx.x + margin.left;
  const boxY = ctx.y + margin.top;

  // Inner content area (inside border and padding)
  const innerX = boxX + borderSize + padding.left;
  const innerY = boxY + borderSize + padding.top;
  const innerWidth = boxWidth - borderSize * 2 - padding.left - padding.right;
  const innerHeight = boxHeight - borderSize * 2 - padding.top - padding.bottom;

  // Separate relative and absolute children
  const relativeChildren = node.children.filter((c) => c.props.position !== "absolute");
  const absoluteChildren = node.children.filter((c) => c.props.position === "absolute");

  // Measure relative children
  const childMeasurements = relativeChildren.map((c) => ({
    node: c,
    ...measureNode(c),
  }));

  // Calculate total content size and distribute space
  const childBoxes = layoutFlexChildren(
    childMeasurements,
    {
      x: innerX,
      y: innerY,
      width: innerWidth,
      height: innerHeight,
    },
    direction,
    justify,
    align,
    gap,
    absoluteBoxes
  );

  // Layout absolute children (they use the box as their coordinate system)
  for (const absChild of absoluteChildren) {
    const absX = (absChild.props.x as number) ?? 0;
    const absY = (absChild.props.y as number) ?? 0;
    const result = layoutNode(absChild, {
      x: boxX + absX,
      y: boxY + absY,
      width: ctx.width - absX,
      height: ctx.height - absY,
    });
    absoluteBoxes.push(result.box);
    absoluteBoxes.push(...result.absoluteBoxes);
  }

  return {
    box: {
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      innerX,
      innerY,
      innerWidth,
      innerHeight,
      node,
      children: childBoxes,
      zIndex: (node.props.zIndex as number) ?? 0,
    },
    absoluteBoxes,
  };
}

function layoutFragment(node: VNode, ctx: LayoutContext): LayoutResult {
  const children: LayoutBox[] = [];
  const absoluteBoxes: LayoutBox[] = [];
  let offsetY = 0;

  for (const child of node.children) {
    if (child.props.position === "absolute") {
      const result = layoutNode(child, ctx);
      absoluteBoxes.push(result.box);
      absoluteBoxes.push(...result.absoluteBoxes);
    } else {
      const result = layoutNode(child, { ...ctx, y: ctx.y + offsetY });
      children.push(result.box);
      absoluteBoxes.push(...result.absoluteBoxes);
      offsetY += result.box.height + normalizeSpacing(child.props.margin as any).bottom;
    }
  }

  return {
    box: {
      x: ctx.x,
      y: ctx.y,
      width: ctx.width,
      height: offsetY,
      innerX: ctx.x,
      innerY: ctx.y,
      innerWidth: ctx.width,
      innerHeight: offsetY,
      node,
      children,
      zIndex: 0,
    },
    absoluteBoxes,
  };
}

function layoutFlexChildren(
  children: Array<{ node: VNode; width: number; height: number }>,
  ctx: LayoutContext,
  direction: Direction,
  justify: Justify,
  align: Align,
  gap: number,
  absoluteBoxes: LayoutBox[]
): LayoutBox[] {
  if (children.length === 0) return [];

  const isRow = direction === "row";

  // Calculate total size along main axis (including margins)
  let totalMainSize = 0;
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    const margin = normalizeSpacing(child.node.props.margin as any);
    const mainMarginBefore = isRow ? margin.left : margin.top;
    const mainMarginAfter = isRow ? margin.right : margin.bottom;
    totalMainSize += mainMarginBefore + (isRow ? child.width : child.height) + mainMarginAfter;
    if (i > 0) totalMainSize += gap;
  }

  const availableMain = isRow ? ctx.width : ctx.height;
  const availableCross = isRow ? ctx.height : ctx.width;

  // Calculate starting position and spacing based on justify
  let mainPos = 0;
  let extraGap = 0;

  switch (justify) {
    case "start":
      mainPos = 0;
      break;
    case "center":
      mainPos = Math.max(0, (availableMain - totalMainSize) / 2);
      break;
    case "end":
      mainPos = Math.max(0, availableMain - totalMainSize);
      break;
    case "space-between":
      if (children.length > 1) {
        extraGap = Math.max(0, (availableMain - totalMainSize + gap * (children.length - 1)) / (children.length - 1));
      }
      break;
    case "space-around":
      if (children.length > 0) {
        const totalSpace = availableMain - totalMainSize + gap * (children.length - 1);
        extraGap = totalSpace / children.length;
        mainPos = extraGap / 2;
      }
      break;
  }

  // Layout each child
  const boxes: LayoutBox[] = [];

  for (const child of children) {
    const margin = normalizeSpacing(child.node.props.margin as any);
    const childMainSize = isRow ? child.width : child.height;
    const childCrossSize = isRow ? child.height : child.width;
    const mainMarginBefore = isRow ? margin.left : margin.top;
    const mainMarginAfter = isRow ? margin.right : margin.bottom;

    // Calculate cross-axis position based on align
    let crossPos = 0;
    // Always constrain child size to available space
    let actualCrossSize = Math.min(childCrossSize, availableCross);

    switch (align) {
      case "start":
        crossPos = 0;
        break;
      case "center":
        crossPos = Math.max(0, (availableCross - actualCrossSize) / 2);
        break;
      case "end":
        crossPos = Math.max(0, availableCross - actualCrossSize);
        break;
      case "stretch":
        crossPos = 0;
        actualCrossSize = availableCross;
        break;
    }

    const childX = isRow ? ctx.x + mainPos : ctx.x + crossPos;
    const childY = isRow ? ctx.y + crossPos : ctx.y + mainPos;
    const childWidth = isRow ? childMainSize : actualCrossSize;
    const childHeight = isRow ? actualCrossSize : childMainSize;

    const result = layoutNode(child.node, {
      x: childX,
      y: childY,
      width: childWidth,
      height: childHeight,
    });

    boxes.push(result.box);
    absoluteBoxes.push(...result.absoluteBoxes);

    mainPos += mainMarginBefore + childMainSize + mainMarginAfter + (justify === "space-between" || justify === "space-around" ? extraGap : gap);
  }

  return boxes;
}

/**
 * Recursively collect all text content from a node's children.
 */
function collectTextContent(node: VNode): string {
  if (isTextNode(node)) {
    return getTextContent(node);
  }

  let result = "";
  for (const child of node.children) {
    result += collectTextContent(child);
  }
  return result;
}

/**
 * Wrap text to fit within a given width.
 * Breaks on word boundaries when possible, otherwise hard-wraps.
 */
function wrapText(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];

  const inputLines = text.split("\n");
  const outputLines: string[] = [];

  for (const line of inputLines) {
    if (line.length <= maxWidth) {
      outputLines.push(line);
      continue;
    }

    // Need to wrap this line
    let remaining = line;
    while (remaining.length > maxWidth) {
      // Try to find a word boundary (space) to break at
      let breakPoint = remaining.lastIndexOf(" ", maxWidth);

      // If no space found or it's too early in the line, hard wrap
      if (breakPoint <= 0 || breakPoint < maxWidth / 2) {
        breakPoint = maxWidth;
      }

      outputLines.push(remaining.slice(0, breakPoint));
      remaining = remaining.slice(breakPoint).trimStart(); // Remove leading space from next line
    }

    if (remaining.length > 0) {
      outputLines.push(remaining);
    }
  }

  return outputLines;
}

/**
 * Check if a position is within the clip region.
 */
function isInClip(x: number, y: number, clip: ClipRegion | null): boolean {
  if (!clip) return true;
  return x >= clip.minX && x < clip.maxX && y >= clip.minY && y < clip.maxY;
}

/**
 * Intersect two clip regions, returning the overlapping area.
 */
function intersectClip(a: ClipRegion | null, b: ClipRegion): ClipRegion {
  if (!a) return b;
  return {
    minX: Math.max(a.minX, b.minX),
    minY: Math.max(a.minY, b.minY),
    maxX: Math.min(a.maxX, b.maxX),
    maxY: Math.min(a.maxY, b.maxY),
  };
}

/**
 * Render a LayoutBox tree to a CellBuffer.
 */
export function renderToBuffer(box: LayoutBox, buffer: CellBuffer, clip: ClipRegion | null = null): void {
  const { node, x, y, width, height } = box;

  // Handle text nodes - split on newlines
  if (isTextNode(node)) {
    const style = (node.props.style as Style) ?? {};
    const text = getTextContent(node);
    const lines = text.split("\n");

    // Render each line on a separate row
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineY = y + lineIdx;
      // Skip if entire line is outside clip region
      if (clip && (lineY < clip.minY || lineY >= clip.maxY)) continue;

      const line = lines[lineIdx]!;
      // Write each character, respecting clip
      for (let i = 0; i < line.length; i++) {
        const charX = x + i;
        if (isInClip(charX, lineY, clip)) {
          buffer.setCharMerge(charX, lineY, line[i]!, style);
        }
      }
    }
    return;
  }

  // Skip fragments, just render children
  if (node.type === "fragment") {
    for (const childBox of box.children) {
      renderToBuffer(childBox, buffer, clip);
    }
    return;
  }

  // Handle <input> elements with cursor and placeholder styling
  if (node.type === "input") {
    const input = node.props.input as Input;
    const baseStyle = (node.props.style as Style) ?? { color: "white" };
    const cursorStyle = (node.props.cursorStyle as Style) ?? { background: "white", color: "black" };
    const placeholderStyle = (node.props.placeholderStyle as Style) ?? { dim: true };

    const displayValue = input.displayValue();
    const cursorPos = input.cursorPos();
    const isFocused = input.focused();
    const isPlaceholder = input.showingPlaceholder();

    const textStyle: Style = isPlaceholder
      ? { ...baseStyle, ...placeholderStyle }
      : baseStyle;

    // Split into lines - each line is a row
    const lines = displayValue.split("\n");

    // Render all rows from 0 to height (always fill the bounding box)
    let charPos = 0;
    for (let lineIdx = 0; lineIdx < height; lineIdx++) {
      const lineY = y + lineIdx;
      // Skip if entire line is outside clip region
      if (clip && (lineY < clip.minY || lineY >= clip.maxY)) {
        if (lineIdx < lines.length) charPos += lines[lineIdx]!.length + 1;
        continue;
      }

      if (lineIdx < lines.length) {
        // Render actual line content
        const line = lines[lineIdx]!;

        // Is cursor on this line?
        const cursorOnThisLine = isFocused && cursorPos >= charPos && cursorPos <= charPos + line.length;

        for (let i = 0; i < width; i++) {
          const charX = x + i;
          if (!isInClip(charX, lineY, clip)) continue;

          if (cursorOnThisLine && i === cursorPos - charPos) {
            const cursorChar = line[i] || " ";
            buffer.set(charX, lineY, createCell(cursorChar, cursorStyle));
          } else if (i < line.length) {
            buffer.setCharMerge(charX, lineY, line[i]!, textStyle);
          } else {
            buffer.setCharMerge(charX, lineY, " ", textStyle);
          }
        }

        charPos += line.length + 1; // +1 for the newline character
      } else {
        // Empty row (beyond actual content) - fill with spaces
        for (let i = 0; i < width; i++) {
          const charX = x + i;
          if (isInClip(charX, lineY, clip)) {
            buffer.setCharMerge(charX, lineY, " ", {});
          }
        }
      }
    }
    return;
  }

  // Handle <select> elements with options and pointer
  if (node.type === "select") {
    const select = node.props.select as Select<unknown>;
    const pointer = node.props.pointer as VNode | undefined;
    const pointerWidth = (node.props.pointerWidth as number) ?? 2;
    const baseOptionStyle = (node.props.optionStyle as Style) ?? {};
    const selectedStyle = (node.props.selectedStyle as Style) ?? {};

    const optionChildren = node.children.filter((c) => c.type === "option");

    // Render each option
    optionChildren.forEach((opt, index) => {
      const optY = y + index;
      if (clip && (optY < clip.minY || optY >= clip.maxY)) return;

      const isSelected = select.isSelectedIndex(index);

      // Merge styles
      const computedStyle: Style = {
        ...baseOptionStyle,
        ...((opt.props.style as Style) ?? {}),
        ...(isSelected ? selectedStyle : {}),
      };

      // Render pointer column
      const pointerText = isSelected && pointer ? collectTextContent(pointer) : " ".repeat(pointerWidth);
      const pointerStyle = isSelected && pointer && pointer.props.style ? (pointer.props.style as Style) : {};
      for (let i = 0; i < pointerWidth && i < pointerText.length; i++) {
        const charX = x + i;
        if (isInClip(charX, optY, clip)) {
          buffer.setCharMerge(charX, optY, pointerText[i] || " ", pointerStyle);
        }
      }

      // Render option content
      const optText = collectTextContent(opt);
      for (let i = 0; i < optText.length; i++) {
        const charX = x + pointerWidth + i;
        if (isInClip(charX, optY, clip)) {
          buffer.setCharMerge(charX, optY, optText[i]!, computedStyle);
        }
      }
    });

    return;
  }

  // Handle box elements
  if (node.type === "box") {
    const style = (node.props.style as Style) ?? {};
    const borderStyle = getBorderStyle(node.props.border as any);
    const overflow = (node.props.overflow as Overflow) ?? "visible";

    // Fill background if bg color is set
    if (style.background) {
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          const cellX = x + dx;
          const cellY = y + dy;
          if (isInClip(cellX, cellY, clip)) {
            buffer.set(cellX, cellY, createCell(" ", { background: style.background }));
          }
        }
      }
    }

    // Draw border (use merge to preserve background)
    if (borderStyle !== "none") {
      const chars = BORDER_CHARS[borderStyle];
      const borderColor = style.color;

      // Top border
      if (isInClip(x, y, clip)) buffer.setCharMerge(x, y, chars.topLeft, { color: borderColor });
      for (let dx = 1; dx < width - 1; dx++) {
        if (isInClip(x + dx, y, clip)) buffer.setCharMerge(x + dx, y, chars.horizontal, { color: borderColor });
      }
      if (isInClip(x + width - 1, y, clip)) buffer.setCharMerge(x + width - 1, y, chars.topRight, { color: borderColor });

      // Side borders
      for (let dy = 1; dy < height - 1; dy++) {
        if (isInClip(x, y + dy, clip)) buffer.setCharMerge(x, y + dy, chars.vertical, { color: borderColor });
        if (isInClip(x + width - 1, y + dy, clip)) buffer.setCharMerge(x + width - 1, y + dy, chars.vertical, { color: borderColor });
      }

      // Bottom border
      if (isInClip(x, y + height - 1, clip)) buffer.setCharMerge(x, y + height - 1, chars.bottomLeft, { color: borderColor });
      for (let dx = 1; dx < width - 1; dx++) {
        if (isInClip(x + dx, y + height - 1, clip)) buffer.setCharMerge(x + dx, y + height - 1, chars.horizontal, { color: borderColor });
      }
      if (isInClip(x + width - 1, y + height - 1, clip)) buffer.setCharMerge(x + width - 1, y + height - 1, chars.bottomRight, { color: borderColor });
    }

    // Calculate clip region for children if overflow is hidden
    let childClip = clip;
    if (overflow === "hidden" || overflow === "scroll") {
      const newClip: ClipRegion = {
        minX: box.innerX,
        minY: box.innerY,
        maxX: box.innerX + box.innerWidth,
        maxY: box.innerY + box.innerHeight,
      };
      childClip = intersectClip(clip, newClip);
    }

    // Render children with potentially updated clip region
    for (const childBox of box.children) {
      renderToBuffer(childBox, buffer, childClip);
    }
    return;
  }

  // Render children (for other node types)
  for (const childBox of box.children) {
    renderToBuffer(childBox, buffer, clip);
  }
}

/**
 * Render a LayoutBox tree to a LogicalBuffer.
 * Text is written at full length - wrapping happens at display time.
 */
export function renderToLogicalBuffer(box: LayoutBox, buffer: LogicalBuffer, clip: ClipRegion | null = null): void {
  const { node, x, y, width, height } = box;

  // Handle text nodes - split on newlines
  if (isTextNode(node)) {
    const style = (node.props.style as Style) ?? {};
    const text = getTextContent(node);
    const lines = text.split("\n");

    // Render each line on a separate row
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineY = y + lineIdx;
      // Skip if entire line is outside clip region
      if (clip && (lineY < clip.minY || lineY >= clip.maxY)) continue;

      const line = lines[lineIdx]!;
      // Write each character, respecting clip - use setMerge to preserve background
      for (let i = 0; i < line.length; i++) {
        const charX = x + i;
        if (isInClip(charX, lineY, clip)) {
          buffer.setMerge(charX, lineY, { char: line[i]!, style });
        }
      }
    }
    return;
  }

  // Skip fragments, just render children
  if (node.type === "fragment") {
    for (const childBox of box.children) {
      renderToLogicalBuffer(childBox, buffer, clip);
    }
    return;
  }

  // Handle <input> elements with cursor and placeholder styling
  if (node.type === "input") {
    const input = node.props.input as Input;
    const baseStyle = (node.props.style as Style) ?? { color: "white" };
    const cursorStyle = (node.props.cursorStyle as Style) ?? { background: "white", color: "black" };
    const placeholderStyle = (node.props.placeholderStyle as Style) ?? { dim: true };

    const displayValue = input.displayValue();
    const cursorPos = input.cursorPos();
    const isFocused = input.focused();
    const isPlaceholder = input.showingPlaceholder();

    const textStyle: Style = isPlaceholder
      ? { ...baseStyle, ...placeholderStyle }
      : baseStyle;

    // Split into lines - each line is a row
    const lines = displayValue.split("\n");

    // Render all rows from 0 to height (always fill the bounding box)
    let charPos = 0;
    for (let lineIdx = 0; lineIdx < height; lineIdx++) {
      const lineY = y + lineIdx;
      // Skip if entire line is outside clip region
      if (clip && (lineY < clip.minY || lineY >= clip.maxY)) {
        if (lineIdx < lines.length) charPos += lines[lineIdx]!.length + 1;
        continue;
      }

      if (lineIdx < lines.length) {
        // Render actual line content
        const line = lines[lineIdx]!;

        // Is cursor on this line?
        const cursorOnThisLine = isFocused && cursorPos >= charPos && cursorPos <= charPos + line.length;

        for (let i = 0; i < width; i++) {
          const charX = x + i;
          if (!isInClip(charX, lineY, clip)) continue;

          const char = i < line.length ? line[i]! : " ";
          const style = cursorOnThisLine && i === cursorPos - charPos ? cursorStyle : textStyle;
          // Cursor uses set (full style replacement), text uses setMerge (preserve background)
          if (cursorOnThisLine && i === cursorPos - charPos) {
            buffer.set(charX, lineY, { char, style });
          } else {
            buffer.setMerge(charX, lineY, { char, style });
          }
        }

        charPos += line.length + 1; // +1 for the newline character
      } else {
        // Empty row (beyond actual content) - fill with spaces, preserve background
        for (let i = 0; i < width; i++) {
          const charX = x + i;
          if (isInClip(charX, lineY, clip)) {
            buffer.setMerge(charX, lineY, { char: " ", style: {} });
          }
        }
      }
    }
    return;
  }

  // Handle <select> elements with options and pointer
  if (node.type === "select") {
    const select = node.props.select as Select<unknown>;
    const pointer = node.props.pointer as VNode | undefined;
    const pointerWidth = (node.props.pointerWidth as number) ?? 2;
    const baseOptionStyle = (node.props.optionStyle as Style) ?? {};
    const selectedStyle = (node.props.selectedStyle as Style) ?? {};

    const optionChildren = node.children.filter((c) => c.type === "option");

    // Render each option
    optionChildren.forEach((opt, index) => {
      const optY = y + index;
      if (clip && (optY < clip.minY || optY >= clip.maxY)) return;

      const isSelected = select.isSelectedIndex(index);

      // Merge styles
      const computedStyle: Style = {
        ...baseOptionStyle,
        ...((opt.props.style as Style) ?? {}),
        ...(isSelected ? selectedStyle : {}),
      };

      // Render pointer column
      const pointerText = isSelected && pointer ? collectTextContent(pointer) : " ".repeat(pointerWidth);
      const pointerStyle = isSelected && pointer && pointer.props.style ? (pointer.props.style as Style) : {};
      for (let i = 0; i < pointerWidth && i < pointerText.length; i++) {
        const charX = x + i;
        if (isInClip(charX, optY, clip)) {
          buffer.setMerge(charX, optY, { char: pointerText[i] || " ", style: pointerStyle });
        }
      }

      // Render option content
      const optText = collectTextContent(opt);
      for (let i = 0; i < optText.length; i++) {
        const charX = x + pointerWidth + i;
        if (isInClip(charX, optY, clip)) {
          buffer.setMerge(charX, optY, { char: optText[i]!, style: computedStyle });
        }
      }
    });

    return;
  }

  // Handle box elements
  if (node.type === "box") {
    const style = (node.props.style as Style) ?? {};
    const borderStyle = getBorderStyle(node.props.border as any);
    const overflow = (node.props.overflow as Overflow) ?? "visible";

    // Fill background if bg color is set
    if (style.background) {
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          const cellX = x + dx;
          const cellY = y + dy;
          if (isInClip(cellX, cellY, clip)) {
            buffer.set(cellX, cellY, { char: " ", style: { background: style.background } });
          }
        }
      }
    }

    // Draw border (use setMerge to preserve background)
    if (borderStyle !== "none") {
      const chars = BORDER_CHARS[borderStyle];
      const borderColor = style.color;

      // Top border
      if (isInClip(x, y, clip)) buffer.setMerge(x, y, { char: chars.topLeft, style: { color: borderColor } });
      for (let dx = 1; dx < width - 1; dx++) {
        if (isInClip(x + dx, y, clip)) buffer.setMerge(x + dx, y, { char: chars.horizontal, style: { color: borderColor } });
      }
      if (isInClip(x + width - 1, y, clip)) buffer.setMerge(x + width - 1, y, { char: chars.topRight, style: { color: borderColor } });

      // Side borders
      for (let dy = 1; dy < height - 1; dy++) {
        if (isInClip(x, y + dy, clip)) buffer.setMerge(x, y + dy, { char: chars.vertical, style: { color: borderColor } });
        if (isInClip(x + width - 1, y + dy, clip)) buffer.setMerge(x + width - 1, y + dy, { char: chars.vertical, style: { color: borderColor } });
      }

      // Bottom border
      if (isInClip(x, y + height - 1, clip)) buffer.setMerge(x, y + height - 1, { char: chars.bottomLeft, style: { color: borderColor } });
      for (let dx = 1; dx < width - 1; dx++) {
        if (isInClip(x + dx, y + height - 1, clip)) buffer.setMerge(x + dx, y + height - 1, { char: chars.horizontal, style: { color: borderColor } });
      }
      if (isInClip(x + width - 1, y + height - 1, clip)) buffer.setMerge(x + width - 1, y + height - 1, { char: chars.bottomRight, style: { color: borderColor } });
    }

    // Calculate clip region for children if overflow is hidden
    let childClip = clip;
    if (overflow === "hidden" || overflow === "scroll") {
      const newClip: ClipRegion = {
        minX: box.innerX,
        minY: box.innerY,
        maxX: box.innerX + box.innerWidth,
        maxY: box.innerY + box.innerHeight,
      };
      childClip = intersectClip(clip, newClip);
    }

    // Render children with potentially updated clip region
    for (const childBox of box.children) {
      renderToLogicalBuffer(childBox, buffer, childClip);
    }
    return;
  }

  // Render children (for other node types)
  for (const childBox of box.children) {
    renderToLogicalBuffer(childBox, buffer, clip);
  }
}
