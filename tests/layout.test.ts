import { describe, expect, it } from "bun:test";
import { computeLayout, renderToBuffer, type LayoutBox } from "../src/core/layout.ts";
import { createVNode, createTextNode } from "../src/core/vnode.ts";
import { CellBuffer } from "../src/core/buffer.ts";

describe("computeLayout", () => {
  it("lays out a simple text node", () => {
    const node = createTextNode("Hello");
    const ctx = { x: 0, y: 0, width: 80, height: 24 };

    const layout = computeLayout(node, ctx);

    expect(layout.x).toBe(0);
    expect(layout.y).toBe(0);
    expect(layout.height).toBe(1);
  });

  it("respects explicit position props for absolute elements", () => {
    // Absolute elements must be children of another element
    const node = createVNode("box", { width: 80, height: 24 }, [
      createVNode("box", { position: "absolute", x: 10, y: 5, width: 20, height: 10 }, []),
    ]);
    const ctx = { x: 0, y: 0, width: 80, height: 24 };

    const layout = computeLayout(node, ctx);

    // Find the absolute child in the rendered children
    const absChild = layout.children.find((c) => c.x === 10 && c.y === 5);
    expect(absChild).toBeDefined();
    expect(absChild!.width).toBe(20);
    expect(absChild!.height).toBe(10);
  });

  it("lays out children in sequence for fragments", () => {
    const node = createVNode("fragment", {}, [
      createTextNode("Line 1"),
      createTextNode("Line 2"),
      createTextNode("Line 3"),
    ]);
    const ctx = { x: 0, y: 0, width: 80, height: 24 };

    const layout = computeLayout(node, ctx);

    expect(layout.children.length).toBe(3);
    expect(layout.children[0]!.y).toBe(0);
    expect(layout.children[1]!.y).toBe(1);
    expect(layout.children[2]!.y).toBe(2);
  });

  it("expands functional components during layout", () => {
    const Header = () => createTextNode("=== Header ===");
    const node = createVNode(Header, {}, []);
    const ctx = { x: 0, y: 0, width: 80, height: 24 };

    const layout = computeLayout(node, ctx);

    expect(layout.node.type).toBe("__text__");
    expect(layout.node.props.text).toBe("=== Header ===");
  });
});

describe("renderToBuffer", () => {
  it("renders text to buffer", () => {
    const node = createTextNode("Hello");
    const ctx = { x: 0, y: 0, width: 80, height: 24 };
    const layout = computeLayout(node, ctx);
    const buffer = new CellBuffer(80, 24);

    renderToBuffer(layout, buffer);

    expect(buffer.get(0, 0).char).toBe("H");
    expect(buffer.get(4, 0).char).toBe("o");
  });

  it("renders text at specified position with absolute", () => {
    const node = createVNode("box", { width: 80, height: 24 }, [
      createVNode("box", { position: "absolute", x: 5, y: 3 }, [createTextNode("Test")]),
    ]);
    const ctx = { x: 0, y: 0, width: 80, height: 24 };
    const layout = computeLayout(node, ctx);
    const buffer = new CellBuffer(80, 24);

    renderToBuffer(layout, buffer);

    expect(buffer.get(5, 3).char).toBe("T");
    expect(buffer.get(8, 3).char).toBe("t");
  });

  it("applies styles from text nodes", () => {
    const node = createVNode("__text__", { text: "Red", style: { color: "red" } }, []);
    const ctx = { x: 0, y: 0, width: 80, height: 24 };
    const layout = computeLayout(node, ctx);
    const buffer = new CellBuffer(80, 24);

    renderToBuffer(layout, buffer);

    expect(buffer.get(0, 0).style.color).toBe("red");
  });

  it("fills box background", () => {
    const node = createVNode("box", { x: 0, y: 0, width: 5, height: 3, style: { background: "blue" } }, []);
    const ctx = { x: 0, y: 0, width: 80, height: 24 };
    const layout = computeLayout(node, ctx);
    const buffer = new CellBuffer(80, 24);

    renderToBuffer(layout, buffer);

    expect(buffer.get(0, 0).style.background).toBe("blue");
    expect(buffer.get(4, 2).style.background).toBe("blue");
    expect(buffer.get(5, 0).style.background).toBeUndefined(); // Outside box
  });
});
