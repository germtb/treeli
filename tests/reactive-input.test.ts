/**
 * Test reactive updates with input signals
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { createSignal, createEffect, createRoot } from "../src/core/reactive.ts";
import { createInput, defaultInputHandler, KEYS } from "../src/core/input.ts";
import { focus } from "../src/core/focus.ts";
import { Renderer } from "../src/core/renderer.ts";
import { jsx } from "../src/jsx/jsx-runtime.ts";

describe("Reactive Input Updates", () => {
  beforeEach(() => {
    focus.clear();
  });

  it("re-renders when input value changes", () => {
    // Create input OUTSIDE the reactive root (like the demo does)
    const input = createInput();
    input.focus();

    const renders: string[] = [];

    function App() {
      const val = input.value();
      const cursor = input.cursorPos();
      renders.push(`val="${val}" cursor=${cursor}`);

      return jsx("text", { children: `Value: ${val} Cursor: ${cursor}` });
    }

    const renderer = new Renderer({ width: 40, height: 5, output: () => {} });

    // Simulate what run() does
    createRoot(() => {
      createEffect(() => {
        const vnode = App();
        renderer.render(vnode);
      });
    });

    console.log("After initial render:", renders);
    expect(renders.length).toBe(1);
    expect(renders[0]).toBe('val="" cursor=0');

    // Type a character
    input.handleKey("a");

    console.log("After typing 'a':", renders);
    expect(renders.length).toBe(2);
    expect(renders[1]).toBe('val="a" cursor=1');

    // Type another character
    input.handleKey("b");

    console.log("After typing 'b':", renders);
    expect(renders.length).toBe(3);
    expect(renders[2]).toBe('val="ab" cursor=2');

    // Check the buffer
    const buffer = renderer.getCurrentBuffer();
    const output = buffer.toDebugString();
    console.log("Buffer:", output);
    expect(output).toContain("ab");
  });

  it("re-renders when regular signal changes", () => {
    const [count, setCount] = createSignal(0);
    const renders: number[] = [];

    function App() {
      const c = count();
      renders.push(c);
      return jsx("text", { children: `Count: ${c}` });
    }

    const renderer = new Renderer({ width: 40, height: 5, output: () => {} });

    createRoot(() => {
      createEffect(() => {
        renderer.render(App());
      });
    });

    expect(renders).toEqual([0]);

    setCount(1);
    expect(renders).toEqual([0, 1]);

    setCount(2);
    expect(renders).toEqual([0, 1, 2]);
  });

  it("input signals work like regular signals", () => {
    const input = createInput();
    const reads: string[] = [];

    createRoot(() => {
      createEffect(() => {
        reads.push(input.value());
      });
    });

    expect(reads).toEqual([""]);

    input.focus();
    input.handleKey("x");
    expect(reads).toEqual(["", "x"]);

    input.handleKey("y");
    expect(reads).toEqual(["", "x", "xy"]);
  });
});
