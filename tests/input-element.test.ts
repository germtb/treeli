/**
 * Test multiline input rendering with the <input> element
 */

import { describe, test, expect } from "bun:test";
import { createInput } from "../src/core/input.ts";
import { CellBuffer } from "../src/core/buffer.ts";
import { computeLayout, renderToBuffer } from "../src/core/layout.ts";
import { createVNode } from "../src/core/vnode.ts";

describe("Multiline input element", () => {
  test("should clear old lines when content shrinks", () => {
    const input = createInput({ placeholder: "Type something..." });
    input.focus();

    const width = 40;
    const inputHeight = 5; // Fixed height for the input
    const bufferHeight = 10;

    // Helper to render current state
    function render() {
      const buffer = new CellBuffer(width, bufferHeight);
      const vnode = createVNode("input", { input, width, height: inputHeight }, []);
      const layout = computeLayout(vnode, { x: 0, y: 0, width, height: bufferHeight });
      renderToBuffer(layout, buffer);
      return buffer;
    }

    // Type "hello"
    for (const char of "hello") {
      input.handleKey(char);
    }
    let buffer = render();

    // Check first line has "hello"
    let line0 = "";
    for (let i = 0; i < width; i++) {
      line0 += buffer.get(i, 0)?.char || " ";
    }
    expect(line0.trim()).toBe("hello");

    // Add newlines
    input.handleKey("\n"); // Shift+Enter
    input.handleKey("\n");
    input.handleKey("\n");

    buffer = render();

    // Should now have 4 lines (hello, empty, empty, empty)
    line0 = "";
    for (let i = 0; i < width; i++) {
      line0 += buffer.get(i, 0)?.char || " ";
    }
    expect(line0.trim()).toBe("hello");

    // Verify cursor is on line 3
    expect(input.value()).toBe("hello\n\n\n");
    expect(input.cursorPos()).toBe(8); // after "hello\n\n\n"

    // Now delete everything (Ctrl+U deletes to start of line)
    input.handleKey("\x15"); // Ctrl+U

    buffer = render();

    // Ctrl+U on an empty line does nothing, so value is still "hello\n\n\n"
    expect(input.value()).toBe("hello\n\n\n");

    // Clear entire input
    input.setValue("");
    buffer = render();

    // First line should show the placeholder
    let line = "";
    for (let i = 0; i < width; i++) {
      line += buffer.get(i, 0)?.char || " ";
    }
    expect(line.trim()).toBe("Type something...");

    // Other lines should be empty
    for (let y = 1; y < inputHeight; y++) {
      line = "";
      for (let i = 0; i < width; i++) {
        line += buffer.get(i, y)?.char || " ";
      }
      expect(line.trim()).toBe("");
    }

    expect(input.value()).toBe("");
  });

  test("should handle typing, newlines, and backspace correctly", () => {
    const input = createInput();
    input.focus();

    const width = 40;
    const inputHeight = 5; // Fixed height
    const bufferHeight = 10;

    function render() {
      const buffer = new CellBuffer(width, bufferHeight);
      const vnode = createVNode("input", { input, width, height: inputHeight }, []);
      const layout = computeLayout(vnode, { x: 0, y: 0, width, height: bufferHeight });
      renderToBuffer(layout, buffer);
      return buffer;
    }

    function getLine(buffer: CellBuffer, y: number): string {
      let line = "";
      for (let i = 0; i < width; i++) {
        line += buffer.get(i, y)?.char || " ";
      }
      return line;
    }

    // Type "line1"
    for (const char of "line1") {
      input.handleKey(char);
    }

    // Add newline
    input.handleKey("\n");

    // Type "line2"
    for (const char of "line2") {
      input.handleKey(char);
    }

    let buffer = render();
    expect(getLine(buffer, 0).trim()).toBe("line1");
    expect(getLine(buffer, 1).trim()).toBe("line2");

    // Delete line2 entirely (5 backspaces)
    for (let i = 0; i < 5; i++) {
      input.handleKey("\x7f"); // Backspace
    }

    // Delete the newline
    input.handleKey("\x7f");

    buffer = render();

    // Should only have "line1" on line 0
    expect(getLine(buffer, 0).trim()).toBe("line1");

    // Line 1 should be completely empty (no artifacts from "line2")
    expect(getLine(buffer, 1).trim()).toBe("");
  });

  test("should handle fixed width properly", () => {
    const input = createInput();
    input.focus();

    const width = 20; // Fixed width of 20
    const height = 10;

    function render() {
      const buffer = new CellBuffer(width + 10, height);
      const vnode = createVNode("input", { input, width }, []);
      const layout = computeLayout(vnode, { x: 0, y: 0, width: width + 10, height });
      renderToBuffer(layout, buffer);
      return buffer;
    }

    // Type a long line
    for (const char of "this is a very long line of text") {
      input.handleKey(char);
    }

    const buffer = render();

    // Should fill exactly width (20) characters on line 0
    for (let i = 0; i < width; i++) {
      const cell = buffer.get(i, 0);
      expect(cell?.char).toBeDefined();
    }
  });
});
