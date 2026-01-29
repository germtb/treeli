/**
 * Test that mimics exactly what run() does
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { createRoot, createEffect } from "../src/core/reactive.ts";
import { createInput } from "../src/core/input.ts";
import { focus } from "../src/core/focus.ts";
import { Renderer } from "../src/core/renderer.ts";
import { render } from "../src/core/app.ts";
import { jsx } from "../src/jsx/jsx-runtime.ts";

describe("Run simulation", () => {
  beforeEach(() => {
    focus.clear();
  });

  it("updates when input changes via render()", () => {
    const input = createInput();
    input.focus();

    const outputs: string[] = [];

    function App() {
      const val = input.value();
      const cursor = input.cursorPos();
      return jsx("text", { children: `[${val}] cursor:${cursor}` });
    }

    // Use the actual render() function from app.ts
    const app = render(App, {
      width: 40,
      height: 5,
      output: (s) => {
        outputs.push(s);
      },
    });

    console.log("Initial outputs:", outputs.length);
    const initialBuffer = app.renderer.getCurrentBuffer().toDebugString();
    console.log("Initial buffer:", initialBuffer);

    expect(initialBuffer).toContain("[] cursor:0");

    // Simulate keypress
    outputs.length = 0; // clear
    input.handleKey("x");

    console.log("After 'x' outputs:", outputs.length);
    const afterXBuffer = app.renderer.getCurrentBuffer().toDebugString();
    console.log("After 'x' buffer:", afterXBuffer);

    expect(afterXBuffer).toContain("[x] cursor:1");

    // Another keypress
    outputs.length = 0;
    input.handleKey("y");

    const afterYBuffer = app.renderer.getCurrentBuffer().toDebugString();
    console.log("After 'y' buffer:", afterYBuffer);

    expect(afterYBuffer).toContain("[xy] cursor:2");

    app.dispose();
  });

  it("tracks signals read in App()", () => {
    const input = createInput();
    input.focus();

    let effectRuns = 0;

    // This is what render() does internally
    createRoot(() => {
      createEffect(() => {
        effectRuns++;
        // Read the signals
        const val = input.value();
        const cursor = input.cursorPos();
        console.log(`Effect run ${effectRuns}: val="${val}" cursor=${cursor}`);
      });
    });

    expect(effectRuns).toBe(1);

    input.handleKey("a");
    console.log("After 'a', effectRuns:", effectRuns);
    // Should have run again because value() changed
    expect(effectRuns).toBeGreaterThan(1);
  });
});
