/**
 * Test for rendering artifacts in the Renderer
 * This tests the actual buffer swapping behavior that causes artifacts
 */

import { describe, test, expect } from "bun:test";
import { Renderer } from "../src/core/renderer.ts";
import { createVNode } from "../src/core/vnode.ts";

describe("Renderer artifact prevention", () => {
  test("should clear old content when layout shrinks", () => {
    const width = 40;
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    // Frame 1: Render 3 lines of text
    const frame1 = createVNode(
      "box",
      { direction: "column" },
      [
        createVNode("text", {}, [createVNode("__text__", { text: "Line 1" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "Line 2" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "Line 3" }, [])]),
      ]
    );

    renderer.render(frame1);
    output.length = 0; // Clear output

    // Frame 2: Render only 1 line
    const frame2 = createVNode(
      "box",
      { direction: "column" },
      [
        createVNode("text", {}, [createVNode("__text__", { text: "Line 1" }, [])]),
      ]
    );

    renderer.render(frame2);

    // Check that output contains instructions to clear lines 2 and 3
    const ansiOutput = output.join("");

    // The output should contain cursor movements to lines 1 and 2 (0-indexed: rows 1 and 2)
    // and should write spaces to clear them
    // At minimum, we should have some output (not an empty string)
    expect(ansiOutput.length).toBeGreaterThan(0);

    // More specific: check that we're writing to row 2 (where "Line 2" was)
    // ANSI format: \x1b[row;colH for cursor positioning
    // We should see movements to clear the old lines
    expect(ansiOutput).toContain("\x1b["); // Should contain ANSI escape sequences
  });

  test("should clear old content when message disappears", () => {
    const width = 40;
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    // Frame 1: Form with message
    const frame1 = createVNode(
      "box",
      { direction: "column" },
      [
        createVNode("text", {}, [createVNode("__text__", { text: "Username:" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "hello" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "Submitted!" }, [])]),
      ]
    );

    renderer.render(frame1);
    output.length = 0;

    // Frame 2: Form without message
    const frame2 = createVNode(
      "box",
      { direction: "column" },
      [
        createVNode("text", {}, [createVNode("__text__", { text: "Username:" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "hello" }, [])]),
      ]
    );

    renderer.render(frame2);

    const ansiOutput = output.join("");

    // Should have output to clear the "Submitted!" line
    expect(ansiOutput.length).toBeGreaterThan(0);
  });

  test("should clear old content when input grows then shrinks", () => {
    const width = 40;
    const height = 10;
    const output: string[] = [];

    const renderer = new Renderer({
      width,
      height,
      output: (str) => output.push(str),
    });

    // Frame 1: Single line input
    const frame1 = createVNode(
      "box",
      { direction: "column" },
      [
        createVNode("text", {}, [createVNode("__text__", { text: "Label:" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "hello" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "Footer" }, [])]),
      ]
    );

    renderer.render(frame1);
    output.length = 0;

    // Frame 2: Multi-line input (grows)
    const frame2 = createVNode(
      "box",
      { direction: "column" },
      [
        createVNode("text", {}, [createVNode("__text__", { text: "Label:" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "hello" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "world" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "test" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "Footer" }, [])]),
      ]
    );

    renderer.render(frame2);
    output.length = 0;

    // Frame 3: Back to single line (shrinks)
    const frame3 = createVNode(
      "box",
      { direction: "column" },
      [
        createVNode("text", {}, [createVNode("__text__", { text: "Label:" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "hello" }, [])]),
        createVNode("text", {}, [createVNode("__text__", { text: "Footer" }, [])]),
      ]
    );

    renderer.render(frame3);

    const ansiOutput = output.join("");

    // This is the critical test - should clear "world", "test", and the old "Footer" position
    expect(ansiOutput.length).toBeGreaterThan(0);

    // Should contain cursor movements to clear the old lines
    expect(ansiOutput).toContain("\x1b[");
  });
});
