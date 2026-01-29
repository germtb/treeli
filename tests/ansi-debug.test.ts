/**
 * Debug ANSI output for input rendering
 */

import { describe, it } from "bun:test";
import { createInput, defaultInputHandler, KEYS } from "../src/core/input.ts";
import { Renderer } from "../src/core/renderer.ts";
import { jsx } from "../src/jsx/jsx-runtime.ts";

describe("ANSI Output Debug", () => {
  it("shows ANSI codes for input rendering", () => {
    const input = createInput();
    input.focus();

    // Capture ANSI output
    let ansiOutput = "";

    function InputField() {
      const display = input.displayValue();
      const cursor = input.cursorPos();

      const beforeCursor = display.slice(0, cursor);
      const cursorChar = display[cursor] || " ";
      const afterCursor = display.slice(cursor + 1);

      return jsx("box", {
        direction: "row",
        children: [
          jsx("text", {
            style: { color: "cyan" },
            children: "Input:",
          }),
          jsx("box", {
            direction: "row",
            children: [
              jsx("text", {
                style: { color: "white" },
                children: beforeCursor,
              }),
              jsx("text", {
                style: { background: "white", color: "black" },
                children: cursorChar,
              }),
              jsx("text", {
                style: { color: "white" },
                children: afterCursor,
              }),
            ],
          }),
        ],
      });
    }

    const renderer = new Renderer({
      width: 30,
      height: 3,
      output: (s) => {
        ansiOutput += s;
      },
    });

    // Initial render
    renderer.render(InputField());
    console.log("=== Initial ANSI output ===");
    console.log(JSON.stringify(ansiOutput));
    console.log("Raw:", ansiOutput);
    console.log("---");

    // Type something
    ansiOutput = "";
    input.handleKey("h");
    input.handleKey("i");
    renderer.render(InputField());

    console.log("=== After typing 'hi' ===");
    console.log(JSON.stringify(ansiOutput));
    console.log("Raw:", ansiOutput);
    console.log("---");

    // Show buffer state
    const buffer = renderer.getCurrentBuffer();
    console.log("Buffer line 0:");
    for (let x = 0; x < 20; x++) {
      const cell = buffer.get(x, 0);
      if (cell.char !== " " || cell.style.background || cell.style.color) {
        console.log(`  (${x}): char="${cell.char}" style=`, cell.style);
      }
    }
  });
});
