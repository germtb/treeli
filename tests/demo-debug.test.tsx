/**
 * Test that mimics the reactive-demo structure to debug issues.
 */

import { describe, expect, it } from "bun:test";
import {
  createSignal,
  createMemo,
  createRoot,
  createEffect,
} from "../src/core/reactive.ts";
import { Renderer } from "../src/core/renderer.ts";
import { render } from "../src/core/app.ts";

// Replicate the demo structure
describe("Demo Structure Debug", () => {
  it("counter factory pattern works with rendering", () => {
    function createCounter(initial = 0) {
      const [count, setCount] = createSignal(initial);
      return {
        count,
        increment: () => setCount((c) => c + 1),
        decrement: () => setCount((c) => c - 1),
      };
    }

    const counter = createCounter(0);
    const outputs: string[] = [];

    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: () => {},
    });

    createRoot(() => {
      createEffect(() => {
        // This mimics what the App component does
        const value = counter.count();
        outputs.push(`Count: ${value}`);
      });
    });

    expect(outputs).toEqual(["Count: 0"]);

    counter.increment();
    expect(outputs).toEqual(["Count: 0", "Count: 1"]);

    counter.increment();
    expect(outputs).toEqual(["Count: 0", "Count: 1", "Count: 2"]);
  });

  it("activeCounter switching works", () => {
    const [activeCounter, setActiveCounter] = createSignal<1 | 2>(1);
    const outputs: number[] = [];

    createRoot(() => {
      createEffect(() => {
        outputs.push(activeCounter());
      });
    });

    expect(outputs).toEqual([1]);

    setActiveCounter((a) => (a === 1 ? 2 : 1));
    expect(outputs).toEqual([1, 2]);

    setActiveCounter((a) => (a === 1 ? 2 : 1));
    expect(outputs).toEqual([1, 2, 1]);
  });

  it("render function re-renders on signal change", () => {
    const [count, setCount] = createSignal(0);
    let renderCount = 0;

    const app = render(
      () => {
        renderCount++;
        const c = count();
        return <text>Count: {c}</text>;
      },
      {
        width: 40,
        height: 10,
        output: () => {},
      }
    );

    expect(renderCount).toBe(1);
    expect(app.renderer.getCurrentBuffer().toDebugString()).toContain("Count: 0");

    setCount(5);
    expect(renderCount).toBe(2);
    expect(app.renderer.getCurrentBuffer().toDebugString()).toContain("Count: 5");

    setCount(10);
    expect(renderCount).toBe(3);
    expect(app.renderer.getCurrentBuffer().toDebugString()).toContain("Count: 10");

    app.dispose();
  });

  it("nested components re-render correctly", () => {
    const [count, setCount] = createSignal(0);
    const [active, setActive] = createSignal(true);
    let parentRenders = 0;
    let childRenders = 0;

    function Child({ value }: { value: number }) {
      childRenders++;
      return <text>Value: {value}</text>;
    }

    function Parent() {
      parentRenders++;
      return (
        <box>
          {active() && <Child value={count()} />}
        </box>
      );
    }

    const app = render(Parent, {
      width: 40,
      height: 10,
      output: () => {},
    });

    expect(parentRenders).toBe(1);
    expect(app.renderer.getCurrentBuffer().toDebugString()).toContain("Value: 0");

    setCount(5);
    expect(parentRenders).toBe(2);
    expect(app.renderer.getCurrentBuffer().toDebugString()).toContain("Value: 5");

    setActive(false);
    expect(parentRenders).toBe(3);
    expect(app.renderer.getCurrentBuffer().toDebugString()).not.toContain("Value:");

    app.dispose();
  });

  it("keyboard simulation triggers updates", () => {
    function createCounter(initial = 0) {
      const [count, setCount] = createSignal(initial);
      return {
        count,
        increment: () => setCount((c) => c + 1),
      };
    }

    const counter = createCounter(0);

    const app = render(
      () => <text>Count: {counter.count()}</text>,
      { width: 40, height: 10, output: () => {} }
    );

    expect(app.renderer.getCurrentBuffer().toDebugString()).toContain("Count: 0");

    // Simulate keyboard: +
    counter.increment();
    expect(app.renderer.getCurrentBuffer().toDebugString()).toContain("Count: 1");

    // Simulate keyboard: + again
    counter.increment();
    expect(app.renderer.getCurrentBuffer().toDebugString()).toContain("Count: 2");

    app.dispose();
  });

  it("conditional rendering with signals", () => {
    const [show, setShow] = createSignal(false);

    const app = render(
      () => (
        <box width={30} height={5}>
          <text>Main</text>
          {show() && (
            <box position="absolute" x={5} y={2}>
              <text>Modal</text>
            </box>
          )}
        </box>
      ),
      { width: 30, height: 5, output: () => {} }
    );

    expect(app.renderer.getCurrentBuffer().toDebugString()).toContain("Main");
    expect(app.renderer.getCurrentBuffer().toDebugString()).not.toContain("Modal");

    setShow(true);
    expect(app.renderer.getCurrentBuffer().toDebugString()).toContain("Modal");

    setShow(false);
    expect(app.renderer.getCurrentBuffer().toDebugString()).not.toContain("Modal");

    app.dispose();
  });
});
