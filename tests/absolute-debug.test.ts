import { describe, expect, it } from "bun:test";
import { computeLayout, renderToBuffer } from "../src/core/layout.ts";
import { createVNode, createTextNode } from "../src/core/vnode.ts";
import { CellBuffer } from "../src/core/buffer.ts";
import { Renderer } from "../src/core/renderer.ts";

describe("Absolute Box Background Debug", () => {
  it("absolute box should have correct layout", () => {
    const node = createVNode("box", { width: 30, height: 10 }, [
      createVNode("box", {
        position: "absolute",
        x: 10,
        y: 2,
        width: 8,
        height: 3,
        style: { background: "red" }
      }, []),
    ]);

    const layout = computeLayout(node, { x: 0, y: 0, width: 30, height: 10 });

    // Find the absolute box in children
    const absBox = layout.children.find(c => c.x === 10 && c.y === 2);

    expect(absBox).toBeDefined();
    expect(absBox!.x).toBe(10);
    expect(absBox!.y).toBe(2);
    expect(absBox!.width).toBe(8);
    expect(absBox!.height).toBe(3);
    expect(absBox!.node.type).toBe("box");
    expect(absBox!.node.props.style).toEqual({ background: "red" });
  });

  it("absolute box background should render with computeLayout+renderToBuffer", () => {
    const node = createVNode("box", { width: 30, height: 10 }, [
      createVNode("box", {
        position: "absolute",
        x: 10,
        y: 2,
        width: 8,
        height: 3,
        style: { background: "red" }
      }, []),
    ]);

    const buffer = new CellBuffer(30, 10);
    const layout = computeLayout(node, { x: 0, y: 0, width: 30, height: 10 });
    renderToBuffer(layout, buffer);

    expect(buffer.get(10, 2).style.background).toBe("red");
  });

  it("absolute box background should render with Renderer", () => {
    const renderer = new Renderer({
      width: 30,
      height: 10,
      output: () => {},
    });

    renderer.render(
      createVNode("box", { width: 30, height: 10 }, [
        createVNode("box", {
          position: "absolute",
          x: 10,
          y: 2,
          width: 8,
          height: 3,
          style: { background: "red" }
        }, []),
      ])
    );

    const buffer = renderer.getCurrentBuffer();
    expect(buffer.get(10, 2).style.background).toBe("red");
  });

  it("matches exact integration test structure", () => {
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

    console.log("Cell at (10, 2):", buffer.get(10, 2));
    console.log("Cell at (15, 3):", buffer.get(15, 3));

    // Inside overlay - should have red bg
    expect(buffer.get(10, 2).style.background).toBe("red");
    expect(buffer.get(15, 3).style.background).toBe("red");
  });
});
