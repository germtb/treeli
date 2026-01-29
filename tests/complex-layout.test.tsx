/**
 * Test: Complex UI layout (NERDTree-style file explorer)
 * Verifies that complex nested layouts render correctly.
 */

import { test, expect, describe } from "bun:test";
import { Renderer } from "../src/core/renderer.ts";
import { computeLayout, renderToLogicalBuffer } from "../src/core/layout.ts";
import { LogicalBuffer } from "../src/core/logical-buffer.ts";
import type { VNode } from "../src/core/vnode.ts";
import { jsx } from "../src/jsx/jsx-runtime.ts";

// Helper to create test renderer
function createTestRenderer(width = 50, height = 20) {
  let output = "";
  const renderer = new Renderer({
    width,
    height,
    output: (s) => {
      output += s;
    },
  });
  return { renderer, getOutput: () => output };
}

// Helper to render VNode to LogicalBuffer and extract text
function renderToText(node: VNode, width = 50, height = 20): string[] {
  const buffer = new LogicalBuffer(height);
  const layout = computeLayout(node, { x: 0, y: 0, width, height });
  renderToLogicalBuffer(layout, buffer);

  const { visualRows } = buffer.toVisualRows(width);
  return visualRows.map(row => row.map(cell => cell.char).join("").trimEnd());
}

describe("Complex UI Layout", () => {
  test("nested boxes with margins layout correctly", () => {
    // Simulate a file tree entry with indentation
    const tree = (
      <box direction="column">
        <box direction="row">
          <text>  </text>
          <text style={{ color: "blue" }}>folder/</text>
        </box>
        <box direction="row" margin={{ left: 2 }}>
          <text>  </text>
          <text style={{ color: "cyan" }}>file.ts</text>
        </box>
        <box direction="row" margin={{ left: 2 }}>
          <text>  </text>
          <text style={{ color: "cyan" }}>other.ts</text>
        </box>
      </box>
    );

    const lines = renderToText(tree as VNode);

    expect(lines[0]).toBe("  folder/");
    expect(lines[1]).toBe("    file.ts");
    expect(lines[2]).toBe("    other.ts");
  });

  test("boxes with gap render with proper spacing", () => {
    const ui = (
      <box direction="column" gap={1}>
        <text>Line 1</text>
        <text>Line 2</text>
        <text>Line 3</text>
      </box>
    );

    const lines = renderToText(ui as VNode);

    // With gap=1, there should be empty lines between items
    expect(lines[0]).toBe("Line 1");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("Line 2");
    expect(lines[3]).toBe("");
    expect(lines[4]).toBe("Line 3");
  });

  test("horizontal flexbox layouts items in row", () => {
    const ui = (
      <box direction="row">
        <text>[Icon]</text>
        <text> </text>
        <text>filename.ts</text>
      </box>
    );

    const lines = renderToText(ui as VNode);

    expect(lines[0]).toBe("[Icon] filename.ts");
  });

  test("complex nested structure with padding and margins", () => {
    const ui = (
      <box direction="column" padding={1}>
        <text style={{ bold: true }}>Header</text>
        <box direction="column" margin={{ top: 1 }}>
          <box direction="row">
            <text>* </text>
            <text>Item 1</text>
          </box>
          <box direction="row">
            <text>* </text>
            <text>Item 2</text>
          </box>
        </box>
        <box margin={{ top: 1 }}>
          <text>Footer</text>
        </box>
      </box>
    );

    const lines = renderToText(ui as VNode);

    // Line 0 is empty (top padding)
    expect(lines[1]).toBe(" Header"); // padding left
    // Line 2 is empty (margin top)
    expect(lines[3]).toBe(" * Item 1");
    expect(lines[4]).toBe(" * Item 2");
    // Line 5 is empty (margin top)
    expect(lines[6]).toBe(" Footer");
  });

  test("selection highlight renders on correct row", () => {
    const items = ["file1.ts", "file2.ts", "file3.ts"];
    const selectedIndex = 1;

    const ui = (
      <box direction="column">
        {items.map((item, i) => (
          <box direction="row">
            <text style={{
              color: i === selectedIndex ? "black" : "white",
              background: i === selectedIndex ? "cyan" : undefined
            }}>
              {item}
            </text>
          </box>
        ))}
      </box>
    );

    const { renderer, getOutput } = createTestRenderer();
    renderer.render(ui as VNode);

    // Check that the buffer has the correct content
    const buffer = renderer.getCurrentBuffer();

    // Row 0: file1.ts (not selected)
    expect(buffer.get(0, 0).char).toBe("f");

    // Row 1: file2.ts (selected) - should have cyan background
    expect(buffer.get(0, 1).char).toBe("f");
    expect(buffer.get(0, 1).style.background).toBe("cyan");
    expect(buffer.get(0, 1).style.color).toBe("black");

    // Row 2: file3.ts (not selected)
    expect(buffer.get(0, 2).char).toBe("f");
    expect(buffer.get(0, 2).style.background).toBeUndefined();
  });

  test("tree structure with expand/collapse arrows", () => {
    const ui = (
      <box direction="column">
        <box direction="row">
          <text style={{ color: { rgb: [100, 100, 100] } }}>▼ </text>
          <text style={{ color: "blue" }}>src/</text>
        </box>
        <box direction="row" margin={{ left: 2 }}>
          <text style={{ color: { rgb: [100, 100, 100] } }}>▶ </text>
          <text style={{ color: "blue" }}>core/</text>
        </box>
        <box direction="row" margin={{ left: 2 }}>
          <text style={{ color: { rgb: [100, 100, 100] } }}>  </text>
          <text style={{ color: "cyan" }}>index.ts</text>
        </box>
      </box>
    );

    const lines = renderToText(ui as VNode);

    expect(lines[0]).toBe("▼ src/");
    expect(lines[1]).toBe("  ▶ core/");
    expect(lines[2]).toBe("    index.ts");
  });

  test("long filenames extend beyond terminal width", () => {
    const ui = (
      <box direction="column">
        <text>short.ts</text>
        <text>this-is-a-very-long-filename-that-exceeds-terminal-width.test.tsx</text>
        <text>another.ts</text>
      </box>
    );

    const width = 30;
    const lines = renderToText(ui as VNode, width);

    // First line should be as-is
    expect(lines[0]).toBe("short.ts");

    // Long line should extend and wrap (handled by toVisualRows)
    // The full text is 68 chars, terminal is 30 wide
    // So it should wrap to multiple visual rows
    expect(lines[1]!.length).toBeGreaterThanOrEqual(30);
  });

  test("empty rows are preserved between items with margin", () => {
    const ui = (
      <box direction="column">
        <text>First</text>
        <box margin={{ top: 2, bottom: 1 }}>
          <text>Middle</text>
        </box>
        <text>Last</text>
      </box>
    );

    const lines = renderToText(ui as VNode);

    expect(lines[0]).toBe("First");
    expect(lines[1]).toBe(""); // margin top 1
    expect(lines[2]).toBe(""); // margin top 2
    expect(lines[3]).toBe("Middle");
    expect(lines[4]).toBe(""); // margin bottom
    expect(lines[5]).toBe("Last");
  });
});
