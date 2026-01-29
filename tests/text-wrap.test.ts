/**
 * Test for text wrapping
 */

import { describe, test, expect } from "bun:test";
import { Renderer } from "../src/core/renderer.ts";
import { createVNode } from "../src/core/vnode.ts";

describe("Text wrapping", () => {
  test("should wrap long text to fit available width", () => {
    const width = 20;
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    // Text that's longer than 20 chars
    const vnode = createVNode("text", { wrap: true }, [
      createVNode("__text__", { text: "This is a long line that should wrap" }, []),
    ]);

    renderer.render(vnode);

    // Check the buffer - text should be split across multiple lines
    const buffer = renderer.getCurrentBuffer();

    // First line should have "This is a long line" (up to word boundary near 20)
    const line1 = [];
    for (let x = 0; x < width; x++) {
      const cell = buffer.get(x, 0);
      if (cell && cell.char !== " ") line1.push(cell.char);
    }
    expect(line1.join("")).toContain("This");

    // Second line should have remaining text
    const line2 = [];
    for (let x = 0; x < width; x++) {
      const cell = buffer.get(x, 1);
      if (cell && cell.char !== " ") line2.push(cell.char);
    }
    // Should have wrapped content
    expect(line2.length).toBeGreaterThan(0);
  });

  test("should not wrap text when wrap is false", () => {
    const width = 20;
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    // Short text that fits on one line, without wrap
    const vnode = createVNode("text", {}, [
      createVNode("__text__", { text: "Short text" }, []),
    ]);

    renderer.render(vnode);

    // Check the buffer - text should be on a single line
    const buffer = renderer.getCurrentBuffer();

    // First line should have content
    const line1 = [];
    for (let x = 0; x < width; x++) {
      const cell = buffer.get(x, 0);
      if (cell && cell.char !== " ") line1.push(cell.char);
    }
    expect(line1.join("")).toBe("Shorttext");

    // Second line should be empty (no wrap, single line text)
    const line2 = [];
    for (let x = 0; x < width; x++) {
      const cell = buffer.get(x, 1);
      if (cell && cell.char !== " ") line2.push(cell.char);
    }
    expect(line2.length).toBe(0);
  });

  test("should wrap at word boundaries when possible", () => {
    const width = 15;
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    const vnode = createVNode("text", { wrap: true }, [
      createVNode("__text__", { text: "Hello world test" }, []),
    ]);

    renderer.render(vnode);
    const buffer = renderer.getCurrentBuffer();

    // First line: "Hello world" (11 chars, fits in 15)
    const line1 = [];
    for (let x = 0; x < width; x++) {
      const cell = buffer.get(x, 0);
      if (cell) line1.push(cell.char);
    }
    const line1Text = line1.join("").trim();
    expect(line1Text).toBe("Hello world");

    // Second line: "test"
    const line2 = [];
    for (let x = 0; x < width; x++) {
      const cell = buffer.get(x, 1);
      if (cell) line2.push(cell.char);
    }
    const line2Text = line2.join("").trim();
    expect(line2Text).toBe("test");
  });

  test("should hard-wrap when no word boundary available", () => {
    const width = 10;
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    // Long word with no spaces
    const vnode = createVNode("text", { wrap: true }, [
      createVNode("__text__", { text: "abcdefghijklmnop" }, []),
    ]);

    renderer.render(vnode);
    const buffer = renderer.getCurrentBuffer();

    // First line: first 10 chars
    const line1 = [];
    for (let x = 0; x < width; x++) {
      const cell = buffer.get(x, 0);
      if (cell) line1.push(cell.char);
    }
    expect(line1.join("")).toBe("abcdefghij");

    // Second line: remaining chars
    const line2 = [];
    for (let x = 0; x < width; x++) {
      const cell = buffer.get(x, 1);
      if (cell) line2.push(cell.char);
    }
    expect(line2.join("").trim()).toBe("klmnop");
  });

  test("should preserve existing newlines when wrapping", () => {
    const width = 20;
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    const vnode = createVNode("text", { wrap: true }, [
      createVNode("__text__", { text: "Line1\nLine2" }, []),
    ]);

    renderer.render(vnode);
    const buffer = renderer.getCurrentBuffer();

    // First line: "Line1"
    const line1 = [];
    for (let x = 0; x < width; x++) {
      const cell = buffer.get(x, 0);
      if (cell) line1.push(cell.char);
    }
    expect(line1.join("").trim()).toBe("Line1");

    // Second line: "Line2"
    const line2 = [];
    for (let x = 0; x < width; x++) {
      const cell = buffer.get(x, 1);
      if (cell) line2.push(cell.char);
    }
    expect(line2.join("").trim()).toBe("Line2");
  });

  test("should wrap text inside a box with border", () => {
    const width = 22; // 20 inner + 2 for borders
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    const vnode = createVNode(
      "box",
      { border: "single", width: 22, height: 5 },
      [
        createVNode("text", { wrap: true }, [
          createVNode("__text__", { text: "This is a long message that should wrap inside the box" }, []),
        ]),
      ]
    );

    renderer.render(vnode);
    const buffer = renderer.getCurrentBuffer();

    // Check that border is present
    expect(buffer.get(0, 0)?.char).toBe("┌");
    expect(buffer.get(21, 0)?.char).toBe("┐");

    // Check that text is inside the border (starts at x=1)
    const line1 = [];
    for (let x = 1; x < 21; x++) {
      const cell = buffer.get(x, 1);
      if (cell) line1.push(cell.char);
    }
    const line1Text = line1.join("").trim();
    expect(line1Text.length).toBeLessThanOrEqual(20); // Should fit within inner width

    // Should have wrapped to second content line (y=2)
    const line2 = [];
    for (let x = 1; x < 21; x++) {
      const cell = buffer.get(x, 2);
      if (cell) line2.push(cell.char);
    }
    const line2Text = line2.join("").trim();
    expect(line2Text.length).toBeGreaterThan(0); // Should have content
  });

  test("should wrap text respecting box padding", () => {
    const width = 30;
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    // Box with border (2 chars) + padding (2 chars on each side) = 6 chars overhead
    // So inner width = 30 - 2 - 4 = 24
    const vnode = createVNode(
      "box",
      { border: "single", padding: 2, width: 30 },
      [
        createVNode("text", { wrap: true }, [
          createVNode("__text__", { text: "This is a somewhat long message that should wrap to fit the inner width" }, []),
        ]),
      ]
    );

    renderer.render(vnode);
    const buffer = renderer.getCurrentBuffer();

    // Border is at x=0
    expect(buffer.get(0, 0)?.char).toBe("┌");
    // Content starts at x=3 (border=1 + padding=2)

    // Collect first line of text (starting after border + padding)
    const line1 = [];
    for (let x = 3; x < 27; x++) { // 3 to 27 = 24 chars (inner width)
      const cell = buffer.get(x, 3); // y=3 (top border + top padding)
      if (cell && cell.char !== " ") line1.push(cell.char);
    }
    const line1Text = line1.join("");

    // Text should wrap at 24 chars or less
    expect(line1Text.length).toBeLessThanOrEqual(24);
    expect(line1Text.length).toBeGreaterThan(0); // Should have content
  });

  test("should wrap differently in boxes of different widths", () => {
    const width = 50;
    const height = 20;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    const longText = "This is a message that will wrap differently depending on box width";

    // Two boxes side by side with different widths
    const vnode = createVNode(
      "box",
      { direction: "row", gap: 2 },
      [
        // Narrow box (15 chars inner = 17 with borders)
        createVNode(
          "box",
          { border: "single", width: 17 },
          [
            createVNode("text", { wrap: true }, [
              createVNode("__text__", { text: longText }, []),
            ]),
          ]
        ),
        // Wide box (25 chars inner = 27 with borders)
        createVNode(
          "box",
          { border: "single", width: 27 },
          [
            createVNode("text", { wrap: true }, [
              createVNode("__text__", { text: longText }, []),
            ]),
          ]
        ),
      ]
    );

    renderer.render(vnode);
    const buffer = renderer.getCurrentBuffer();

    // Check narrow box (starts at x=0, inner starts at x=1)
    const narrowLine1 = [];
    for (let x = 1; x < 16; x++) { // 15 chars wide
      const cell = buffer.get(x, 1);
      if (cell) narrowLine1.push(cell.char);
    }
    const narrowLine1Text = narrowLine1.join("").trim();
    expect(narrowLine1Text.length).toBeLessThanOrEqual(15);
    expect(narrowLine1Text.length).toBeGreaterThan(0);

    // Check wide box (starts at x=19, inner starts at x=20)
    const wideLine1 = [];
    for (let x = 20; x < 45; x++) { // 25 chars wide
      const cell = buffer.get(x, 1);
      if (cell) wideLine1.push(cell.char);
    }
    const wideLine1Text = wideLine1.join("").trim();
    expect(wideLine1Text.length).toBeLessThanOrEqual(25);

    // Wide box should have more text on first line than narrow box
    expect(wideLine1Text.length).toBeGreaterThan(narrowLine1Text.length);
  });

  test("should wrap correctly in log viewer style overlay", () => {
    // Simulate the log viewer overlay structure
    const termWidth = 80;
    const termHeight = 24;
    const output: string[] = [];

    const renderer = new Renderer({
      width: termWidth,
      height: termHeight,
      output: (str) => output.push(str),
    });

    // Log viewer uses: x: 2, y: 2, width: termWidth - 4, height: termHeight - 4
    // border: "double", padding: 1
    // So inner width = (80 - 4) - 2 (borders) - 2 (padding) = 72
    const overlayWidth = termWidth - 4; // 76
    const expectedInnerWidth = overlayWidth - 2 - 2; // 72 (borders + padding)

    const longLogMessage = "[12:34:56.789] INFO  This is a very long log message that should definitely wrap to fit within the console log viewer panel without overflowing";

    // Need wrapper box for absolute positioning to work
    const vnode = createVNode("box", {}, [
      createVNode(
        "box",
        {
          position: "absolute" as const,
          x: 2,
          y: 2,
          width: overlayWidth,
          height: termHeight - 4,
          border: "double" as const,
          padding: 1,
          style: { background: "black", color: "white" },
        },
        [
          createVNode("text", { style: { bold: true, color: "cyan" }, wrap: true }, [
            createVNode("__text__", { text: "Console Logs (1) - Ctrl+L to close" }, []),
          ]),
          createVNode("text", {}, [createVNode("__text__", { text: "" }, [])]),
          createVNode("text", { wrap: true }, [
            createVNode("__text__", { text: longLogMessage }, []),
          ]),
        ]
      ),
    ]);

    renderer.render(vnode);
    const buffer = renderer.getCurrentBuffer();

    // Check border exists at expected position
    expect(buffer.get(2, 2)?.char).toBe("╔");
    expect(buffer.get(77, 2)?.char).toBe("╗");

    // First content line starts at x: 2 + 1 (border) + 1 (padding) = 4, y: 2 + 1 + 1 = 4
    const contentStartX = 4;
    const contentEndX = 4 + expectedInnerWidth; // 76

    // Header line (y=4)
    const headerLine = [];
    for (let x = contentStartX; x < contentEndX; x++) {
      const cell = buffer.get(x, 4);
      if (cell) headerLine.push(cell.char);
    }
    const headerText = headerLine.join("").trim();
    expect(headerText).toBe("Console Logs (1) - Ctrl+L to close");
    expect(headerText.length).toBeLessThanOrEqual(expectedInnerWidth);

    // Log message first line (y=6 after empty line)
    const logLine1 = [];
    for (let x = contentStartX; x < contentEndX; x++) {
      const cell = buffer.get(x, 6);
      if (cell) logLine1.push(cell.char);
    }
    const logLine1Text = logLine1.join("").trim();
    expect(logLine1Text.length).toBeLessThanOrEqual(expectedInnerWidth);
    expect(logLine1Text.length).toBeGreaterThan(0);

    // Should have wrapped to second line (y=7)
    const logLine2 = [];
    for (let x = contentStartX; x < contentEndX; x++) {
      const cell = buffer.get(x, 7);
      if (cell) logLine2.push(cell.char);
    }
    const logLine2Text = logLine2.join("").trim();
    expect(logLine2Text.length).toBeGreaterThan(0); // Should have wrapped content
  });

  test("should constrain text to parent width even when text is longer", () => {
    const width = 40;
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    // Very long text (100 chars) in a narrow container (30 chars inner)
    const longText = "A".repeat(100);

    const vnode = createVNode(
      "box",
      { border: "single", width: 32 }, // 30 inner width
      [
        createVNode("text", { wrap: true }, [
          createVNode("__text__", { text: longText }, []),
        ]),
      ]
    );

    renderer.render(vnode);
    const buffer = renderer.getCurrentBuffer();

    // Check that text on first line doesn't exceed inner width (30 chars)
    const line1 = [];
    for (let x = 1; x < 31; x++) {
      const cell = buffer.get(x, 1);
      if (cell) line1.push(cell.char);
    }
    expect(line1.join("")).toBe("A".repeat(30));

    // Check that nothing is written outside the box
    // Position 31 should be the right border
    expect(buffer.get(31, 1)?.char).toBe("│");

    // Text should have wrapped to multiple lines
    const line2 = [];
    for (let x = 1; x < 31; x++) {
      const cell = buffer.get(x, 2);
      if (cell) line2.push(cell.char);
    }
    expect(line2.join("")).toBe("A".repeat(30));

    // Third line should have remaining 40 chars
    const line3 = [];
    for (let x = 1; x < 31; x++) {
      const cell = buffer.get(x, 3);
      if (cell) line3.push(cell.char);
    }
    expect(line3.join("")).toBe("A".repeat(30));

    // Fourth line should have last 10 chars
    const line4 = [];
    for (let x = 1; x < 31; x++) {
      const cell = buffer.get(x, 4);
      if (cell) line4.push(cell.char);
    }
    expect(line4.join("").trim()).toBe("A".repeat(10));
  });

});
