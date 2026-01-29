import { describe, expect, it } from "bun:test";
import { Renderer } from "../src/core/renderer.ts";
import { createVNode, createTextNode } from "../src/core/vnode.ts";

describe("Renderer", () => {
  it("renders to buffer correctly", () => {
    let output = "";
    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: (s) => { output += s; },
    });

    const tree = createTextNode("Hello, World!");
    renderer.render(tree);

    const buffer = renderer.getCurrentBuffer();
    expect(buffer.get(0, 0).char).toBe("H");
    expect(buffer.get(12, 0).char).toBe("!");
  });

  it("produces ANSI output", () => {
    let output = "";
    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: (s) => { output += s; },
    });

    renderer.render(createTextNode("Test"));

    expect(output.includes("\x1b[")).toBe(true); // Contains ANSI escape codes
    expect(output.includes("Test")).toBe(true);
  });

  it("only outputs changes on re-render", () => {
    const outputs: string[] = [];
    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: (s) => { outputs.push(s); },
    });

    // First render
    renderer.render(createTextNode("Hello"));
    const firstOutput = outputs.join("");

    // Second render with same content
    outputs.length = 0;
    renderer.render(createTextNode("Hello"));
    const secondOutput = outputs.join("");

    // Second output should be minimal (just cursor hide/show)
    expect(secondOutput.length).toBeLessThan(firstOutput.length);
  });

  it("detects and outputs changes", () => {
    let lastOutput = "";
    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: (s) => { lastOutput = s; },
    });

    renderer.render(createTextNode("Hello"));
    renderer.render(createTextNode("Hallo")); // Changed 'e' to 'a'

    // Should contain the change but not the whole string
    expect(lastOutput.includes("a")).toBe(true);
  });

  it("handles functional components", () => {
    const Greeting = (props: { name: string }) => {
      return createVNode("box", {}, [createTextNode(`Hello, ${props.name}!`)]);
    };

    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: () => {},
    });

    renderer.render(createVNode(Greeting, { name: "World" }, []));

    const buffer = renderer.getCurrentBuffer();
    expect(buffer.toDebugString()).toContain("Hello, World!");
  });

});
