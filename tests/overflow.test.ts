/**
 * Test for overflow clipping
 */

import { describe, test, expect } from "bun:test";
import { Renderer } from "../src/core/renderer.ts";
import { createVNode } from "../src/core/vnode.ts";

describe("Overflow clipping", () => {
  test("should clip content that overflows box with overflow:hidden", () => {
    const width = 30;
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    // Box with fixed height and overflow:hidden
    // Box height = 5, border = 2 rows, so inner height = 3
    // But we have 5 lines of text
    const vnode = createVNode(
      "box",
      { border: "single", width: 20, height: 5, overflow: "hidden" },
      [
        createVNode("text", {}, [createVNode("__text__", { text: "Line 1" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "Line 2" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "Line 3" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "Line 4" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "Line 5" }, [])]),
      ]
    );

    renderer.render(vnode);
    const buffer = renderer.getCurrentBuffer();

    // Check borders are intact
    expect(buffer.get(0, 0)?.char).toBe("┌");
    expect(buffer.get(19, 0)?.char).toBe("┐");
    expect(buffer.get(0, 4)?.char).toBe("└");
    expect(buffer.get(19, 4)?.char).toBe("┘");

    // Line 1 should be visible (inside box at y=1)
    expect(buffer.get(1, 1)?.char).toBe("L");

    // Lines beyond the inner height (y >= 4) should NOT overwrite the border
    // The bottom border is at y=4
    expect(buffer.get(1, 4)?.char).toBe("─"); // Should be border, not "L"
  });

  test("should clip content horizontally with overflow:hidden", () => {
    const width = 30;
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    // Narrow box with long text
    const vnode = createVNode(
      "box",
      { border: "single", width: 12, height: 3, overflow: "hidden" },
      [
        createVNode("text", {}, [
          createVNode("__text__", { text: "This is a very long line" }, []),
        ]),
      ]
    );

    renderer.render(vnode);
    const buffer = renderer.getCurrentBuffer();

    // Check borders are intact
    expect(buffer.get(0, 0)?.char).toBe("┌");
    expect(buffer.get(11, 0)?.char).toBe("┐");
    expect(buffer.get(11, 1)?.char).toBe("│"); // Right border intact

    // Text inside (inner width = 10)
    expect(buffer.get(1, 1)?.char).toBe("T");
    expect(buffer.get(2, 1)?.char).toBe("h");
    expect(buffer.get(3, 1)?.char).toBe("i");
    expect(buffer.get(4, 1)?.char).toBe("s");

    // The right border should NOT be overwritten
    expect(buffer.get(11, 1)?.char).toBe("│");
  });

  test("should allow content overflow when overflow:visible (default)", () => {
    const width = 30;
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    // Box without overflow:hidden (default is visible)
    const vnode = createVNode(
      "box",
      { border: "single", width: 12, height: 3 }, // No overflow prop
      [
        createVNode("text", {}, [
          createVNode("__text__", { text: "This is a very long line" }, []),
        ]),
      ]
    );

    renderer.render(vnode);
    const buffer = renderer.getCurrentBuffer();

    // Text should overflow past the border
    // The text "This is a very long line" starts at x=1 (inside left border)
    // Position 10 in the string is "v" (from "very"), so it should be at x=11
    expect(buffer.get(11, 1)?.char).toBe("v");
    // Position 15 is "l" (from "long"), so it should be at x=16
    expect(buffer.get(16, 1)?.char).toBe("l");
  });

  test("should clip nested box content", () => {
    const width = 40;
    const height = 15;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    // Outer box with overflow:hidden, inner box with lots of content
    const vnode = createVNode(
      "box",
      { border: "double", width: 20, height: 6, overflow: "hidden" },
      [
        createVNode(
          "box",
          { border: "single" },
          [
            createVNode("text", {}, [createVNode("__text__", { text: "Row 1" }, [])]),
            createVNode("text", {}, [createVNode("__text__", { text: "Row 2" }, [])]),
            createVNode("text", {}, [createVNode("__text__", { text: "Row 3" }, [])]),
            createVNode("text", {}, [createVNode("__text__", { text: "Row 4" }, [])]),
            createVNode("text", {}, [createVNode("__text__", { text: "Row 5" }, [])]),
            createVNode("text", {}, [createVNode("__text__", { text: "Row 6" }, [])]),
          ]
        ),
      ]
    );

    renderer.render(vnode);
    const buffer = renderer.getCurrentBuffer();

    // Outer box borders should be intact
    expect(buffer.get(0, 0)?.char).toBe("╔");
    expect(buffer.get(19, 0)?.char).toBe("╗");
    expect(buffer.get(0, 5)?.char).toBe("╚");
    expect(buffer.get(19, 5)?.char).toBe("╝");

    // Inner box should be visible
    expect(buffer.get(1, 1)?.char).toBe("┌");

    // Bottom row of outer box should be the outer border, not inner content
    expect(buffer.get(1, 5)?.char).toBe("═");
  });

  test("should handle log viewer style overlay with overflow:hidden", () => {
    const termWidth = 80;
    const termHeight = 24;
    const output: string[] = [];

    const renderer = new Renderer({
      width: termWidth,
      height: termHeight,
      output: (str) => output.push(str),
    });

    const overlayWidth = termWidth - 4; // 76
    const overlayHeight = termHeight - 4; // 20

    // Create many log messages that would overflow
    const messages = Array.from({ length: 30 }, (_, i) =>
      `[12:34:56.${String(i).padStart(3, '0')}] LOG   This is log message ${i + 1} with some extra text to make it long`
    );

    const vnode = createVNode("box", {}, [
      createVNode(
        "box",
        {
          position: "absolute" as const,
          x: 2,
          y: 2,
          width: overlayWidth,
          height: overlayHeight,
          border: "double" as const,
          padding: 1,
          overflow: "hidden" as const,
          style: { background: "black", color: "white" },
        },
        [
          createVNode("text", { style: { bold: true, color: "cyan" } }, [
            createVNode("__text__", { text: `Console Logs (${messages.length})` }, []),
          ]),
          createVNode("text", {}, [createVNode("__text__", { text: "" }, [])]),
          ...messages.map((msg) =>
            createVNode("text", { wrap: true }, [
              createVNode("__text__", { text: msg }, []),
            ])
          ),
        ]
      ),
    ]);

    renderer.render(vnode);
    const buffer = renderer.getCurrentBuffer();

    // Top border at y=2
    expect(buffer.get(2, 2)?.char).toBe("╔");
    expect(buffer.get(77, 2)?.char).toBe("╗");

    // Bottom border at y=21 (2 + 20 - 1 = 21)
    expect(buffer.get(2, 21)?.char).toBe("╚");
    expect(buffer.get(77, 21)?.char).toBe("╝");

    // Content should not overflow past the bottom border
    // Row 22 should be empty or have the outer box content, not log messages
    const row22 = [];
    for (let x = 3; x < 77; x++) {
      const cell = buffer.get(x, 22);
      if (cell && cell.char !== " ") row22.push(cell.char);
    }
    // Row 22 is outside the overlay, should be empty
    expect(row22.length).toBe(0);
  });
});
