/**
 * Integration tests for reactive rendering with interactions.
 * These tests simulate the full render cycle and keyboard interactions.
 */

import { describe, expect, it } from "bun:test";
import { createSignal, createMemo, createRoot, createEffect } from "../src/core/reactive.ts";
import { Renderer } from "../src/core/renderer.ts";
import { CellBuffer } from "../src/core/buffer.ts";
import { createVNode, createTextNode, type VNode } from "../src/core/vnode.ts";

// Helper to render and get buffer contents
function renderToString(
  renderFn: () => VNode,
  width = 40,
  height = 10
): string {
  const renderer = new Renderer({
    width,
    height,
    output: () => {}, // Suppress output
  });

  let result = "";
  createRoot(() => {
    createEffect(() => {
      const vnode = renderFn();
      renderer.render(vnode);
      result = renderer.getCurrentBuffer().toDebugString();
    });
  });

  return result;
}

// Helper to create a test harness for interactive apps
function createTestApp<T>(
  initialState: T,
  renderFn: (state: T, setState: (fn: (s: T) => T) => void) => VNode,
  width = 40,
  height = 10
) {
  const [state, setState] = createSignal(initialState);
  const renderer = new Renderer({
    width,
    height,
    output: () => {},
  });

  let disposeRoot: (() => void) | null = null;

  disposeRoot = createRoot((dispose) => {
    createEffect(() => {
      const vnode = renderFn(state(), (fn) => setState(fn));
      renderer.render(vnode);
    });
    return dispose;
  }) as () => void;

  return {
    getBuffer: () => renderer.getCurrentBuffer(),
    getOutput: () => renderer.getCurrentBuffer().toDebugString(),
    setState: (fn: (s: T) => T) => setState(fn),
    getState: () => state(),
    dispose: () => disposeRoot?.(),
  };
}

describe("Reactive Rendering", () => {
  it("renders initial state", () => {
    const [count] = createSignal(42);

    const output = renderToString(() =>
      createVNode("text", {}, [createTextNode(`Count: ${count()}`)])
    );

    expect(output).toContain("Count: 42");
  });

  it("updates when signal changes", () => {
    const [count, setCount] = createSignal(0);
    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: () => {},
    });

    createRoot(() => {
      createEffect(() => {
        renderer.render(
          createVNode("text", {}, [createTextNode(`Count: ${count()}`)])
        );
      });
    });

    expect(renderer.getCurrentBuffer().toDebugString()).toContain("Count: 0");

    setCount(5);
    expect(renderer.getCurrentBuffer().toDebugString()).toContain("Count: 5");

    setCount(100);
    expect(renderer.getCurrentBuffer().toDebugString()).toContain("Count: 100");
  });

  it("updates derived state (memo)", () => {
    const [count, setCount] = createSignal(5);
    const doubled = createMemo(() => count() * 2);

    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: () => {},
    });

    createRoot(() => {
      createEffect(() => {
        renderer.render(
          createVNode("text", {}, [createTextNode(`Doubled: ${doubled()}`)])
        );
      });
    });

    expect(renderer.getCurrentBuffer().toDebugString()).toContain("Doubled: 10");

    setCount(20);
    expect(renderer.getCurrentBuffer().toDebugString()).toContain("Doubled: 40");
  });
});

describe("Interactive App Simulation", () => {
  it("simulates counter increment/decrement", () => {
    interface State {
      count: number;
    }

    const app = createTestApp<State>(
      { count: 0 },
      (state, setState) =>
        createVNode("box", {}, [
          createVNode("text", {}, [createTextNode(`Count: ${state.count}`)]),
        ])
    );

    expect(app.getOutput()).toContain("Count: 0");

    // Simulate pressing +
    app.setState((s) => ({ ...s, count: s.count + 1 }));
    expect(app.getOutput()).toContain("Count: 1");

    // Simulate pressing + again
    app.setState((s) => ({ ...s, count: s.count + 1 }));
    expect(app.getOutput()).toContain("Count: 2");

    // Simulate pressing -
    app.setState((s) => ({ ...s, count: s.count - 1 }));
    expect(app.getOutput()).toContain("Count: 1");

    app.dispose();
  });

  it("simulates tab switching between items", () => {
    interface State {
      activeIndex: number;
      items: string[];
    }

    const app = createTestApp<State>(
      { activeIndex: 0, items: ["Home", "Settings", "Profile"] },
      (state) =>
        createVNode("box", { direction: "row", gap: 2 },
          state.items.map((item, i) =>
            createVNode("text", {
              style: { color: i === state.activeIndex ? "green" : "white" }
            }, [createTextNode(i === state.activeIndex ? `[${item}]` : item)])
          )
        )
    );

    expect(app.getOutput()).toContain("[Home]");
    expect(app.getState().activeIndex).toBe(0);

    // Simulate Tab
    app.setState((s) => ({
      ...s,
      activeIndex: (s.activeIndex + 1) % s.items.length
    }));
    expect(app.getOutput()).toContain("[Settings]");
    expect(app.getState().activeIndex).toBe(1);

    // Simulate Tab again
    app.setState((s) => ({
      ...s,
      activeIndex: (s.activeIndex + 1) % s.items.length
    }));
    expect(app.getOutput()).toContain("[Profile]");

    // Simulate Tab - should wrap
    app.setState((s) => ({
      ...s,
      activeIndex: (s.activeIndex + 1) % s.items.length
    }));
    expect(app.getOutput()).toContain("[Home]");
    expect(app.getState().activeIndex).toBe(0);

    app.dispose();
  });

  it("simulates modal toggle", () => {
    interface State {
      showModal: boolean;
    }

    const app = createTestApp<State>(
      { showModal: false },
      (state) =>
        createVNode("box", { width: 30, height: 10 }, [
          createVNode("text", {}, [createTextNode("Main Content")]),
          ...(state.showModal ? [
            createVNode("box", { position: "absolute", x: 5, y: 2, width: 15, height: 3, border: true }, [
              createVNode("text", {}, [createTextNode("Modal!")]),
            ])
          ] : []),
        ]),
      30,
      10
    );

    expect(app.getOutput()).toContain("Main Content");
    expect(app.getOutput()).not.toContain("Modal!");

    // Show modal
    app.setState((s) => ({ showModal: true }));
    expect(app.getOutput()).toContain("Modal!");

    // Hide modal
    app.setState((s) => ({ showModal: false }));
    expect(app.getOutput()).not.toContain("Modal!");

    app.dispose();
  });
});

describe("Layout Integration", () => {
  it("renders row layout correctly", () => {
    const output = renderToString(() =>
      createVNode("box", { direction: "row", gap: 1 }, [
        createVNode("text", {}, [createTextNode("A")]),
        createVNode("text", {}, [createTextNode("B")]),
        createVNode("text", {}, [createTextNode("C")]),
      ])
    );

    expect(output.split("\n")[0]).toContain("A B C");
  });

  it("renders column layout correctly", () => {
    const output = renderToString(() =>
      createVNode("box", { direction: "column" }, [
        createVNode("text", {}, [createTextNode("Line1")]),
        createVNode("text", {}, [createTextNode("Line2")]),
        createVNode("text", {}, [createTextNode("Line3")]),
      ])
    );

    const lines = output.split("\n");
    expect(lines[0]).toContain("Line1");
    expect(lines[1]).toContain("Line2");
    expect(lines[2]).toContain("Line3");
  });

  it("renders border correctly", () => {
    const output = renderToString(() =>
      createVNode("box", { border: "single", width: 10, height: 3 }, [
        createVNode("text", {}, [createTextNode("Hi")]),
      ])
    );

    const lines = output.split("\n");
    expect(lines[0]).toContain("┌");
    expect(lines[0]).toContain("┐");
    expect(lines[1]).toContain("│");
    expect(lines[2]).toContain("└");
    expect(lines[2]).toContain("┘");
  });

  it("renders absolute positioned overlay", () => {
    const output = renderToString(() =>
      createVNode("box", { width: 20, height: 5 }, [
        createVNode("text", {}, [createTextNode("Background")]),
        createVNode("box", { position: "absolute", x: 5, y: 2 }, [
          createVNode("text", {}, [createTextNode("Overlay")]),
        ]),
      ]),
      20,
      5
    );

    const lines = output.split("\n");
    expect(lines[0]).toContain("Background");
    expect(lines[2]?.slice(5)).toContain("Overlay");
  });
});

describe("Style Integration", () => {
  it("applies text styles", () => {
    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: () => {},
    });

    renderer.render(
      createVNode("text", { style: { color: "red", bold: true } }, [
        createTextNode("Styled"),
      ])
    );

    const buffer = renderer.getCurrentBuffer();
    expect(buffer.get(0, 0).style.color).toBe("red");
    expect(buffer.get(0, 0).style.bold).toBe(true);
  });

  it("applies background to box", () => {
    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: () => {},
    });

    renderer.render(
      createVNode("box", { width: 10, height: 3, style: { background: "blue" } }, [])
    );

    const buffer = renderer.getCurrentBuffer();
    expect(buffer.get(0, 0).style.background).toBe("blue");
    expect(buffer.get(5, 1).style.background).toBe("blue");
    expect(buffer.get(10, 0).style.background).toBeUndefined(); // Outside box
  });

  it("overlay without bg does not fill cells with background", () => {
    const renderer = new Renderer({
      width: 30,
      height: 10,
      output: () => {},
    });

    // Render main content with a background, then overlay without bg
    renderer.render(
      createVNode("box", { width: 30, height: 10 }, [
        createVNode("text", { style: { color: "white" } }, [createTextNode("Background text here")]),
        createVNode("box", { position: "absolute", x: 5, y: 3, width: 10, height: 3, border: true }, [
          createVNode("text", {}, [createTextNode("Modal")]),
        ]),
      ])
    );

    const buffer = renderer.getCurrentBuffer();

    // Modal border should be rendered
    expect(buffer.get(5, 3).char).toBe("┌");

    // Cell outside modal but on same row should NOT have a background from modal
    expect(buffer.get(0, 3).style.background).toBeUndefined();
    expect(buffer.get(20, 3).style.background).toBeUndefined();

    // Modal content
    expect(buffer.get(6, 4).char).toBe("M"); // "Modal" starts after border+padding
  });

  it("overlay with bg only fills its own area", () => {
    const renderer = new Renderer({
      width: 30,
      height: 10,
      output: () => {},
    });

    renderer.render(
      createVNode("box", { width: 30, height: 10 }, [
        createVNode("text", {}, [createTextNode("Main")]),
        createVNode("box", {
          position: "absolute",
          x: 10,
          y: 2,
          width: 8,
          height: 3,
          style: { background: "red" }
        }, [
          createVNode("text", {}, [createTextNode("Alert")]),
        ]),
      ])
    );

    const buffer = renderer.getCurrentBuffer();

    // Inside overlay - should have red bg
    expect(buffer.get(10, 2).style.background).toBe("red");
    expect(buffer.get(15, 3).style.background).toBe("red");

    // Outside overlay - should NOT have red bg
    expect(buffer.get(9, 2).style.background).toBeUndefined();
    expect(buffer.get(18, 2).style.background).toBeUndefined();
    expect(buffer.get(10, 5).style.background).toBeUndefined();
  });
});

describe("Keyboard Simulation", () => {
  // Simulates what would happen in the actual app
  it("handles typical TUI key codes", () => {
    const keys = {
      TAB: "\t",
      ENTER: "\r",
      ESCAPE: "\x1b",
      CTRL_C: "\x03",
      PLUS: "+",
      MINUS: "-",
      EQUALS: "=",
      UNDERSCORE: "_",
      UP: "\x1b[A",
      DOWN: "\x1b[B",
      RIGHT: "\x1b[C",
      LEFT: "\x1b[D",
    };

    // Verify key code values
    expect(keys.TAB).toBe("\t");
    expect(keys.ENTER).toBe("\r");
    expect(keys.ESCAPE.charCodeAt(0)).toBe(27);
    expect(keys.CTRL_C.charCodeAt(0)).toBe(3);

    // Simulate key handler
    const events: string[] = [];
    const handleKey = (key: string) => {
      switch (key) {
        case keys.TAB:
          events.push("tab");
          break;
        case keys.PLUS:
        case keys.EQUALS:
          events.push("increment");
          break;
        case keys.MINUS:
        case keys.UNDERSCORE:
          events.push("decrement");
          break;
        default:
          if (key.startsWith("\x1b[")) {
            events.push("arrow");
          }
      }
    };

    handleKey(keys.TAB);
    handleKey(keys.PLUS);
    handleKey(keys.MINUS);
    handleKey(keys.UP);

    expect(events).toEqual(["tab", "increment", "decrement", "arrow"]);
  });
});
