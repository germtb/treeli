/**
 * Test for input element rendering with newlines
 */

import { describe, test, expect } from "bun:test";
import { createInput } from "../src/core/input.ts";
import { Renderer } from "../src/core/renderer.ts";
import { createVNode } from "../src/core/vnode.ts";

describe("Input element with newlines", () => {
  test("should not leave artifacts when typing newlines", () => {
    const width = 80;
    const height = 20;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    const input = createInput({ placeholder: "Type something..." });
    input.focus();

    // Helper to render current state
    function render() {
      output.length = 0; // Clear previous output
      const vnode = createVNode(
        "box",
        { direction: "column", gap: 1 },
        [
          createVNode("text", { style: { color: "yellow" } }, [
            createVNode("__text__", { text: "Type something (Shift+Enter for newlines, Ctrl+C to quit):" }, [])
          ]),
          createVNode("input", { input }, []),
          createVNode("text", { style: { color: "cyan" } }, [
            createVNode("__text__", { text: `Value: "${input.value()}" | Cursor: ${input.cursorPos()}` }, [])
          ]),
        ]
      );
      renderer.render(vnode);
      return output.join("");
    }

    // Initial render
    render();

    // Type a newline
    input.handleKey("\n");
    const output1 = render();

    // Should have output, but should be clean (no corrupted text)
    expect(output1.length).toBeGreaterThan(0);

    // Type another newline
    input.handleKey("\n");
    const output2 = render();

    // Should still have output
    expect(output2.length).toBeGreaterThan(0);

    // Type a third newline
    input.handleKey("\n");
    const output3 = render();

    // Value should be 3 newlines
    expect(input.value()).toBe("\n\n\n");
    expect(input.cursorPos()).toBe(3);

    // Clear the input
    input.setValue("");
    const output4 = render();

    // Should clear everything - no artifacts
    expect(output4.length).toBeGreaterThan(0);
    expect(input.value()).toBe("");
  });

  test("should handle typing text then newlines then more text", () => {
    const width = 80;
    const height = 20;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    const input = createInput();
    input.focus();

    function render() {
      output.length = 0;
      const vnode = createVNode(
        "box",
        { direction: "column" },
        [
          createVNode("text", {}, [createVNode("__text__", { text: "Input:" }, [])]),
          createVNode("input", { input }, []),
        ]
      );
      renderer.render(vnode);
    }

    // Initial state
    render();

    // Type "hello"
    for (const char of "hello") {
      input.handleKey(char);
    }
    render();
    expect(input.value()).toBe("hello");

    // Add newline
    input.handleKey("\n");
    render();
    expect(input.value()).toBe("hello\n");

    // Type "world"
    for (const char of "world") {
      input.handleKey(char);
    }
    render();
    expect(input.value()).toBe("hello\nworld");

    // Add another newline
    input.handleKey("\n");
    render();
    expect(input.value()).toBe("hello\nworld\n");

    // Type "test"
    for (const char of "test") {
      input.handleKey(char);
    }
    render();
    expect(input.value()).toBe("hello\nworld\ntest");

    // Now delete everything
    input.setValue("");
    render();

    // Should be completely clear
    expect(input.value()).toBe("");
  });

  test("should handle growing and shrinking multiline input without artifacts", () => {
    const width = 80;
    const height = 20;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    const input = createInput();
    input.focus();

    function render() {
      output.length = 0;
      const vnode = createVNode(
        "box",
        { direction: "column" },
        [
          createVNode("text", {}, [createVNode("__text__", { text: "Label:" }, [])]),
          createVNode("input", { input }, []),
          createVNode("text", {}, [createVNode("__text__", { text: "Footer" }, [])]),
        ]
      );
      renderer.render(vnode);
      return output.join("");
    }

    // Start with single line
    input.setValue("line1");
    render();

    // Grow to 3 lines
    input.setValue("line1\nline2\nline3");
    render();
    expect(input.value()).toBe("line1\nline2\nline3");

    // Shrink back to 1 line
    input.setValue("line1");
    const finalOutput = render();

    expect(input.value()).toBe("line1");
    // Should have output (clearing old lines)
    expect(finalOutput.length).toBeGreaterThan(0);
  });

  test("should handle embedding input value with newlines in debug text", () => {
    const width = 80;
    const height = 20;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    const input = createInput({ placeholder: "Type something..." });
    input.focus();

    let renderCount = 0;

    function render() {
      output.length = 0;
      renderCount++;

      const val = input.value();
      const cursor = input.cursorPos();

      // This is what simple-input.tsx does - embeds value in text
      const vnode = createVNode(
        "box",
        { direction: "column", gap: 1 },
        [
          createVNode("text", { style: { color: "yellow" } }, [
            createVNode("__text__", { text: "Type something (Shift+Enter for newlines, Ctrl+C to quit):" }, [])
          ]),
          createVNode("input", { input }, []),
          createVNode("text", { style: { color: "cyan" } }, [
            createVNode("__text__", { text: `Value: "${val}" | Cursor: ${cursor} | Renders: ${renderCount}` }, [])
          ]),
        ]
      );
      renderer.render(vnode);
      return output.join("");
    }

    // Start empty
    render();

    // Type newline
    input.handleKey("\n");
    render();
    expect(input.value()).toBe("\n");

    // Type another newline
    input.handleKey("\n");
    render();
    expect(input.value()).toBe("\n\n");

    // Type third newline
    input.handleKey("\n");
    render();
    expect(input.value()).toBe("\n\n\n");

    // Now clear - this should clear all artifacts
    input.setValue("");
    const clearOutput = render();

    expect(input.value()).toBe("");
    expect(clearOutput.length).toBeGreaterThan(0);

    // Type some text after clearing
    input.setValue("test");
    render();
    expect(input.value()).toBe("test");
  });
});
