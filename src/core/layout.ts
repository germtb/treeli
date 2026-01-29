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
} from "./props.ts";

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
    return { width: text.length, height: 1 };
  }

  // <text> element: collect all child text
  if (node.type === "text") {
    const text = collectTextContent(node);
    return { width: text.length, height: 1 };
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
    return {
      box: {
        x: ctx.x,
        y: ctx.y,
        width: Math.min(getTextContent(node).length, ctx.width),
        height: 1,
        innerX: ctx.x,
        innerY: ctx.y,
        innerWidth: Math.min(getTextContent(node).length, ctx.width),
        innerHeight: 1,
        node,
        children: [],
        zIndex: (node.props.zIndex as number) ?? 0,
      },
      absoluteBoxes: [],
    };
  }

  // Handle <text> element - just output text, let terminal handle wrapping
  if (node.type === "text") {
    const text = collectTextContent(node);

    // Create synthetic node with the text stored in props
    const syntheticNode: VNode = {
      type: TEXT_NODE_TYPE,
      props: {
        text,
        style: node.props.style,
      },
      children: [],
      hash: node.hash + "_text",
    };

    return {
      box: {
        x: ctx.x,
        y: ctx.y,
        width: text.length,
        height: 1,
        innerX: ctx.x,
        innerY: ctx.y,
        innerWidth: text.length,
        innerHeight: 1,
        node: syntheticNode,
        children: [],
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
    let actualCrossSize = childCrossSize;

    switch (align) {
      case "start":
        crossPos = 0;
        break;
      case "center":
        crossPos = Math.max(0, (availableCross - childCrossSize) / 2);
        break;
      case "end":
        crossPos = Math.max(0, availableCross - childCrossSize);
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
 * Render a LayoutBox tree to a CellBuffer.
 */
export function renderToBuffer(box: LayoutBox, buffer: CellBuffer): void {
  const { node, x, y, width, height } = box;

  // Handle text nodes - use merge to preserve parent's background
  if (isTextNode(node)) {
    const style = (node.props.style as Style) ?? {};
    const text = getTextContent(node);
    // Just write the text - let terminal handle wrapping
    buffer.writeStringMerge(x, y, text, style);
    return;
  }

  // Skip fragments, just render children
  if (node.type === "fragment") {
    for (const childBox of box.children) {
      renderToBuffer(childBox, buffer);
    }
    return;
  }

  // Handle box elements
  if (node.type === "box") {
    const style = (node.props.style as Style) ?? {};
    const borderStyle = getBorderStyle(node.props.border as any);

    // Fill background if bg color is set
    if (style.background) {
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          buffer.set(x + dx, y + dy, createCell(" ", { background: style.background }));
        }
      }
    }

    // Draw border (use merge to preserve background)
    if (borderStyle !== "none") {
      const chars = BORDER_CHARS[borderStyle];
      const borderColor = style.color;

      // Top border
      buffer.setCharMerge(x, y, chars.topLeft, { color: borderColor });
      for (let dx = 1; dx < width - 1; dx++) {
        buffer.setCharMerge(x + dx, y, chars.horizontal, { color: borderColor });
      }
      buffer.setCharMerge(x + width - 1, y, chars.topRight, { color: borderColor });

      // Side borders
      for (let dy = 1; dy < height - 1; dy++) {
        buffer.setCharMerge(x, y + dy, chars.vertical, { color: borderColor });
        buffer.setCharMerge(x + width - 1, y + dy, chars.vertical, { color: borderColor });
      }

      // Bottom border
      buffer.setCharMerge(x, y + height - 1, chars.bottomLeft, { color: borderColor });
      for (let dx = 1; dx < width - 1; dx++) {
        buffer.setCharMerge(x + dx, y + height - 1, chars.horizontal, { color: borderColor });
      }
      buffer.setCharMerge(x + width - 1, y + height - 1, chars.bottomRight, { color: borderColor });
    }
  }

  // Render children
  for (const childBox of box.children) {
    renderToBuffer(childBox, buffer);
  }
}

/**
 * Render a LayoutBox tree to a LogicalBuffer.
 * Text is written at full length - wrapping happens at display time.
 */
export function renderToLogicalBuffer(box: LayoutBox, buffer: LogicalBuffer): void {
  const { node, x, y, width, height } = box;

  // Handle text nodes
  if (isTextNode(node)) {
    const style = (node.props.style as Style) ?? {};
    const text = getTextContent(node);
    // Write full text - no clipping, LogicalBuffer extends as needed
    buffer.writeStringMerge(x, y, text, style);
    return;
  }

  // Skip fragments, just render children
  if (node.type === "fragment") {
    for (const childBox of box.children) {
      renderToLogicalBuffer(childBox, buffer);
    }
    return;
  }

  // Handle box elements
  if (node.type === "box") {
    const style = (node.props.style as Style) ?? {};
    const borderStyle = getBorderStyle(node.props.border as any);

    // Fill background if bg color is set
    if (style.background) {
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          buffer.set(x + dx, y + dy, { char: " ", style: { background: style.background } });
        }
      }
    }

    // Draw border
    if (borderStyle !== "none") {
      const chars = BORDER_CHARS[borderStyle];
      const borderColor = style.color;

      // Top border
      buffer.set(x, y, { char: chars.topLeft, style: { color: borderColor } });
      for (let dx = 1; dx < width - 1; dx++) {
        buffer.set(x + dx, y, { char: chars.horizontal, style: { color: borderColor } });
      }
      buffer.set(x + width - 1, y, { char: chars.topRight, style: { color: borderColor } });

      // Side borders
      for (let dy = 1; dy < height - 1; dy++) {
        buffer.set(x, y + dy, { char: chars.vertical, style: { color: borderColor } });
        buffer.set(x + width - 1, y + dy, { char: chars.vertical, style: { color: borderColor } });
      }

      // Bottom border
      buffer.set(x, y + height - 1, { char: chars.bottomLeft, style: { color: borderColor } });
      for (let dx = 1; dx < width - 1; dx++) {
        buffer.set(x + dx, y + height - 1, { char: chars.horizontal, style: { color: borderColor } });
      }
      buffer.set(x + width - 1, y + height - 1, { char: chars.bottomRight, style: { color: borderColor } });
    }
  }

  // Render children
  for (const childBox of box.children) {
    renderToLogicalBuffer(childBox, buffer);
  }
}
