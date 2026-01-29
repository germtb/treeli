/**
 * Tests for input rendering with the actual buffer.
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { createInput, defaultInputHandler, KEYS } from "../src/core/input.ts";
import { focus } from "../src/core/focus.ts";
import { createVNode, createTextNode } from "../src/core/vnode.ts";
import { Renderer } from "../src/core/renderer.ts";

describe("Input Rendering", () => {
  beforeEach(() => {
    focus.clear();
  });

  function renderInputField(input: ReturnType<typeof createInput>, active: boolean) {
    const display = input.displayValue();
    const cursor = input.cursorPos();

    const beforeCursor = display.slice(0, cursor);
    const cursorChar = display[cursor] || " ";
    const afterCursor = display.slice(cursor + 1);

    // Use sibling text elements for different styles (nested text doesn't work)
    return createVNode("box", { direction: "row", gap: 1 }, [
      createVNode("text", { style: { color: active ? "cyan" : "white" } }, [
        createTextNode("Input:"),
      ]),
      createVNode("box", { direction: "row", width: 20, height: 1 }, [
        createVNode("text", { style: { color: active ? "white" : "default" } }, [
          createTextNode(beforeCursor),
        ]),
        createVNode("text", { style: { background: active ? "white" : "default", color: "black" } }, [
          createTextNode(cursorChar),
        ]),
        createVNode("text", { style: { color: active ? "white" : "default" } }, [
          createTextNode(afterCursor),
        ]),
      ]),
    ]);
  }

  it("renders empty input with cursor", () => {
    const input = createInput();
    input.focus();

    const renderer = new Renderer({ width: 40, height: 5, output: () => {} });
    renderer.render(renderInputField(input, true));

    const buffer = renderer.getCurrentBuffer();
    const output = buffer.toDebugString();

    console.log("Empty input:");
    console.log(output);
    console.log("---");

    // Should show "Input:" label
    expect(output).toContain("Input:");

    // Check cursor position - should have a space with white background at position after "Input: "
    const cursorCell = buffer.get(7, 0); // After "Input: " (6 chars + 1 gap)
    console.log("Cursor cell at (7, 0):", cursorCell);
    expect(cursorCell.char).toBe(" ");
    expect(cursorCell.style.background).toBe("white");
  });

  it("renders input with text", () => {
    const input = createInput();
    input.focus();

    // Type "hello"
    input.handleKey("h");
    input.handleKey("e");
    input.handleKey("l");
    input.handleKey("l");
    input.handleKey("o");

    const renderer = new Renderer({ width: 40, height: 5, output: () => {} });
    renderer.render(renderInputField(input, true));

    const buffer = renderer.getCurrentBuffer();
    const output = buffer.toDebugString();

    console.log("After typing 'hello':");
    console.log(output);
    console.log("---");

    expect(output).toContain("hello");

    // Cursor should be at position 12 (7 + 5)
    const cursorCell = buffer.get(12, 0);
    console.log("Cursor cell at (12, 0):", cursorCell);
    expect(cursorCell.char).toBe(" "); // cursor at end shows space
    expect(cursorCell.style.background).toBe("white");

    // Check the 'h' character
    const hCell = buffer.get(7, 0);
    console.log("'h' cell at (7, 0):", hCell);
    expect(hCell.char).toBe("h");
    expect(hCell.style.color).toBe("white");
  });

  it("renders cursor in middle of text", () => {
    const input = createInput({ initialValue: "hello" });
    input.focus();

    // Move cursor to middle (after "he")
    input.handleKey(KEYS.HOME);
    input.handleKey(KEYS.RIGHT);
    input.handleKey(KEYS.RIGHT);

    expect(input.cursorPos()).toBe(2);

    const renderer = new Renderer({ width: 40, height: 5, output: () => {} });
    renderer.render(renderInputField(input, true));

    const buffer = renderer.getCurrentBuffer();
    const output = buffer.toDebugString();

    console.log("Cursor in middle (after 'he'):");
    console.log(output);
    console.log("---");

    // Before cursor: "he" at positions 7, 8
    expect(buffer.get(7, 0).char).toBe("h");
    expect(buffer.get(8, 0).char).toBe("e");

    // Cursor on 'l' at position 9
    const cursorCell = buffer.get(9, 0);
    console.log("Cursor cell at (9, 0):", cursorCell);
    expect(cursorCell.char).toBe("l");
    expect(cursorCell.style.background).toBe("white");
    expect(cursorCell.style.color).toBe("black");

    // After cursor: "lo" at positions 10, 11
    expect(buffer.get(10, 0).char).toBe("l");
    expect(buffer.get(11, 0).char).toBe("o");
  });

  it("shows typing sequence", () => {
    const input = createInput();
    input.focus();

    const renderer = new Renderer({ width: 40, height: 5, output: () => {} });

    const states: string[] = [];

    // Initial state
    renderer.render(renderInputField(input, true));
    states.push(renderer.getCurrentBuffer().toDebugString().split("\n")[0]!);

    // Type each character
    for (const char of "test") {
      input.handleKey(char);
      renderer.render(renderInputField(input, true));
      states.push(renderer.getCurrentBuffer().toDebugString().split("\n")[0]!);
    }

    console.log("Typing sequence:");
    states.forEach((s, i) => console.log(`  ${i}: "${s}"`));

    expect(states[0]).toContain("Input:");
    expect(states[1]).toContain("t");
    expect(states[2]).toContain("te");
    expect(states[3]).toContain("tes");
    expect(states[4]).toContain("test");
  });

  it("renders inactive input differently", () => {
    const input = createInput({ initialValue: "hello" });
    // Don't focus - inactive

    const renderer = new Renderer({ width: 40, height: 5, output: () => {} });
    renderer.render(renderInputField(input, false));

    const buffer = renderer.getCurrentBuffer();
    const output = buffer.toDebugString();

    console.log("Inactive input:");
    console.log(output);
    console.log("---");

    // Label should not be cyan
    const labelCell = buffer.get(0, 0);
    console.log("Label cell at (0, 0):", labelCell);
    expect(labelCell.style.color).toBe("white");

    // Cursor should not have white background (inactive)
    const cursorCell = buffer.get(12, 0); // After "hello"
    console.log("Cursor cell at (12, 0):", cursorCell);
  });

  it("renders password mask", () => {
    const input = createInput({ mask: "*" });
    input.focus();

    input.handleKey("s");
    input.handleKey("e");
    input.handleKey("c");
    input.handleKey("r");
    input.handleKey("e");
    input.handleKey("t");

    expect(input.value()).toBe("secret");
    expect(input.displayValue()).toBe("******");

    const renderer = new Renderer({ width: 40, height: 5, output: () => {} });
    renderer.render(renderInputField(input, true));

    const buffer = renderer.getCurrentBuffer();
    const output = buffer.toDebugString();

    console.log("Password input:");
    console.log(output);
    console.log("---");

    expect(output).toContain("******");
    expect(output).not.toContain("secret");
  });
});
