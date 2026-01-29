import { describe, expect, it } from "bun:test";
import { Renderer } from "../src/core/renderer.ts";
import { CellBuffer } from "../src/core/buffer.ts";
import { computeLayout, renderToBuffer } from "../src/core/layout.ts";
import { createVNode, createTextNode } from "../src/core/vnode.ts";

describe("Flex Layout - Row", () => {
  it("lays out children horizontally", () => {
    const node = createVNode("box", { direction: "row" }, [
      createVNode("text", {}, [createTextNode("A")]),
      createVNode("text", {}, [createTextNode("B")]),
      createVNode("text", {}, [createTextNode("C")]),
    ]);

    const buffer = new CellBuffer(20, 5);
    const layout = computeLayout(node, { x: 0, y: 0, width: 20, height: 5 });
    renderToBuffer(layout, buffer);

    const line = buffer.toDebugString().split("\n")[0]!;
    expect(line.startsWith("ABC")).toBe(true);
  });

  it("respects gap in row", () => {
    const node = createVNode("box", { direction: "row", gap: 2 }, [
      createVNode("text", {}, [createTextNode("A")]),
      createVNode("text", {}, [createTextNode("B")]),
    ]);

    const layout = computeLayout(node, { x: 0, y: 0, width: 20, height: 5 });

    // First child at 0, second at 1 (A width) + 2 (gap) = 3
    expect(layout.children[0]!.x).toBe(0);
    expect(layout.children[1]!.x).toBe(3);
  });

  it("centers children with justify center", () => {
    const node = createVNode(
      "box",
      { direction: "row", justify: "center", width: 10 },
      [createVNode("text", {}, [createTextNode("AB")])]
    );

    const layout = computeLayout(node, { x: 0, y: 0, width: 10, height: 5 });

    // Content is 2 wide, container is 10, so starts at 4
    expect(layout.children[0]!.x).toBe(4);
  });

  it("aligns to end with justify end", () => {
    const node = createVNode(
      "box",
      { direction: "row", justify: "end", width: 10 },
      [createVNode("text", {}, [createTextNode("AB")])]
    );

    const layout = computeLayout(node, { x: 0, y: 0, width: 10, height: 5 });

    // Content is 2 wide, container is 10, so starts at 8
    expect(layout.children[0]!.x).toBe(8);
  });

  it("distributes space with space-between", () => {
    const node = createVNode(
      "box",
      { direction: "row", justify: "space-between", width: 10 },
      [
        createVNode("text", {}, [createTextNode("A")]),
        createVNode("text", {}, [createTextNode("B")]),
      ]
    );

    const layout = computeLayout(node, { x: 0, y: 0, width: 10, height: 5 });

    // A at 0, B at 9 (end)
    expect(layout.children[0]!.x).toBe(0);
    expect(layout.children[1]!.x).toBe(9);
  });
});

describe("Flex Layout - Column", () => {
  it("lays out children vertically by default", () => {
    const node = createVNode("box", {}, [
      createVNode("text", {}, [createTextNode("Line1")]),
      createVNode("text", {}, [createTextNode("Line2")]),
    ]);

    const buffer = new CellBuffer(20, 5);
    const layout = computeLayout(node, { x: 0, y: 0, width: 20, height: 5 });
    renderToBuffer(layout, buffer);

    const lines = buffer.toDebugString().split("\n");
    expect(lines[0]).toContain("Line1");
    expect(lines[1]).toContain("Line2");
  });

  it("respects gap in column", () => {
    const node = createVNode("box", { direction: "column", gap: 2 }, [
      createVNode("text", {}, [createTextNode("A")]),
      createVNode("text", {}, [createTextNode("B")]),
    ]);

    const layout = computeLayout(node, { x: 0, y: 0, width: 20, height: 10 });

    expect(layout.children[0]!.y).toBe(0);
    expect(layout.children[1]!.y).toBe(3); // 1 (height) + 2 (gap)
  });

  it("centers vertically with justify center", () => {
    const node = createVNode(
      "box",
      { direction: "column", justify: "center", height: 5 },
      [createVNode("text", {}, [createTextNode("A")])]
    );

    const layout = computeLayout(node, { x: 0, y: 0, width: 20, height: 5 });

    // Content is 1 high, container is 5, so y = 2
    expect(layout.children[0]!.y).toBe(2);
  });
});

describe("Flex Layout - AlignItems", () => {
  it("aligns items to start (default)", () => {
    const node = createVNode(
      "box",
      { direction: "row", width: 20, height: 5 },
      [createVNode("text", {}, [createTextNode("A")])]
    );

    const layout = computeLayout(node, { x: 0, y: 0, width: 20, height: 5 });
    expect(layout.children[0]!.y).toBe(0);
  });

  it("centers items on cross axis", () => {
    const node = createVNode(
      "box",
      { direction: "row", align: "center", width: 20, height: 5 },
      [createVNode("text", {}, [createTextNode("A")])]
    );

    const layout = computeLayout(node, { x: 0, y: 0, width: 20, height: 5 });
    expect(layout.children[0]!.y).toBe(2); // (5 - 1) / 2
  });

  it("aligns items to end on cross axis", () => {
    const node = createVNode(
      "box",
      { direction: "row", align: "end", width: 20, height: 5 },
      [createVNode("text", {}, [createTextNode("A")])]
    );

    const layout = computeLayout(node, { x: 0, y: 0, width: 20, height: 5 });
    expect(layout.children[0]!.y).toBe(4); // 5 - 1
  });
});

describe("Padding", () => {
  it("applies uniform padding", () => {
    const node = createVNode("box", { padding: 2 }, [
      createVNode("text", {}, [createTextNode("X")]),
    ]);

    const layout = computeLayout(node, { x: 0, y: 0, width: 20, height: 10 });

    // Inner content should start at (2, 2)
    expect(layout.innerX).toBe(2);
    expect(layout.innerY).toBe(2);
    expect(layout.children[0]!.x).toBe(2);
    expect(layout.children[0]!.y).toBe(2);
  });

  it("applies asymmetric padding", () => {
    const node = createVNode("box", { padding: { left: 5, top: 3 } }, [
      createVNode("text", {}, [createTextNode("X")]),
    ]);

    const layout = computeLayout(node, { x: 0, y: 0, width: 20, height: 10 });

    expect(layout.children[0]!.x).toBe(5);
    expect(layout.children[0]!.y).toBe(3);
  });
});

describe("Margin", () => {
  it("offsets box by margin", () => {
    const node = createVNode("box", { margin: 3 }, [
      createVNode("text", {}, [createTextNode("X")]),
    ]);

    const layout = computeLayout(node, { x: 0, y: 0, width: 20, height: 10 });

    expect(layout.x).toBe(3);
    expect(layout.y).toBe(3);
  });
});

describe("Border", () => {
  it("renders single border", () => {
    const node = createVNode(
      "box",
      { border: "single", width: 5, height: 3 },
      []
    );

    const buffer = new CellBuffer(10, 5);
    const layout = computeLayout(node, { x: 0, y: 0, width: 10, height: 5 });
    renderToBuffer(layout, buffer);

    const lines = buffer.toDebugString().split("\n");
    expect(lines[0]!.startsWith("┌───┐")).toBe(true);
    expect(lines[1]!.startsWith("│")).toBe(true);
    expect(lines[2]!.startsWith("└───┘")).toBe(true);
  });

  it("renders rounded border", () => {
    const node = createVNode(
      "box",
      { border: "rounded", width: 5, height: 3 },
      []
    );

    const buffer = new CellBuffer(10, 5);
    const layout = computeLayout(node, { x: 0, y: 0, width: 10, height: 5 });
    renderToBuffer(layout, buffer);

    const lines = buffer.toDebugString().split("\n");
    expect(lines[0]!.startsWith("╭───╮")).toBe(true);
  });

  it("places content inside border", () => {
    const node = createVNode("box", { border: true, width: 7, height: 3 }, [
      createVNode("text", {}, [createTextNode("Hi")]),
    ]);

    const buffer = new CellBuffer(10, 5);
    const layout = computeLayout(node, { x: 0, y: 0, width: 10, height: 5 });
    renderToBuffer(layout, buffer);

    const lines = buffer.toDebugString().split("\n");
    expect(lines[1]).toContain("Hi");
  });
});

describe("Absolute Positioning", () => {
  it("positions absolute elements at specified coordinates", () => {
    const node = createVNode("box", { width: 20, height: 10 }, [
      createVNode("text", {}, [createTextNode("Base")]),
      createVNode("box", { position: "absolute", x: 10, y: 5 }, [
        createVNode("text", {}, [createTextNode("Overlay")]),
      ]),
    ]);

    const buffer = new CellBuffer(20, 10);
    const layout = computeLayout(node, { x: 0, y: 0, width: 20, height: 10 });
    renderToBuffer(layout, buffer);

    // Base at (0, 0)
    expect(buffer.get(0, 0).char).toBe("B");
    // Overlay at (10, 5)
    expect(buffer.get(10, 5).char).toBe("O");
  });

  it("renders absolute elements on top (later in render order)", () => {
    const node = createVNode("box", { width: 10, height: 5 }, [
      createVNode("text", {}, [createTextNode("Under")]),
      createVNode("box", { position: "absolute", x: 0, y: 0 }, [
        createVNode("text", {}, [createTextNode("Over")]),
      ]),
    ]);

    const buffer = new CellBuffer(10, 5);
    const layout = computeLayout(node, { x: 0, y: 0, width: 10, height: 5 });
    renderToBuffer(layout, buffer);

    // "Over" should be visible, not "Under"
    expect(buffer.get(0, 0).char).toBe("O");
  });

  it("respects zIndex for render order", () => {
    const node = createVNode("box", { width: 10, height: 5 }, [
      createVNode("box", { position: "absolute", x: 0, y: 0, zIndex: 10 }, [
        createVNode("text", {}, [createTextNode("High")]),
      ]),
      createVNode("box", { position: "absolute", x: 0, y: 0, zIndex: 5 }, [
        createVNode("text", {}, [createTextNode("Low")]),
      ]),
    ]);

    const buffer = new CellBuffer(10, 5);
    const layout = computeLayout(node, { x: 0, y: 0, width: 10, height: 5 });
    renderToBuffer(layout, buffer);

    // Higher zIndex renders last, so "High" is visible
    expect(buffer.get(0, 0).char).toBe("H");
  });
});

describe("Complex Layouts", () => {
  it("nests row inside column", () => {
    const node = createVNode("box", { direction: "column" }, [
      createVNode("text", {}, [createTextNode("Header")]),
      createVNode("box", { direction: "row", gap: 1 }, [
        createVNode("text", {}, [createTextNode("A")]),
        createVNode("text", {}, [createTextNode("B")]),
        createVNode("text", {}, [createTextNode("C")]),
      ]),
      createVNode("text", {}, [createTextNode("Footer")]),
    ]);

    const buffer = new CellBuffer(20, 5);
    const layout = computeLayout(node, { x: 0, y: 0, width: 20, height: 5 });
    renderToBuffer(layout, buffer);

    const lines = buffer.toDebugString().split("\n");
    expect(lines[0]).toContain("Header");
    expect(lines[1]).toContain("A B C");
    expect(lines[2]).toContain("Footer");
  });

  it("handles padding + border together", () => {
    const node = createVNode(
      "box",
      { border: true, padding: 1, width: 8, height: 5 },
      [createVNode("text", {}, [createTextNode("Hi")])]
    );

    const buffer = new CellBuffer(10, 7);
    const layout = computeLayout(node, { x: 0, y: 0, width: 10, height: 7 });

    // Inner content starts after border (1) + padding (1) = 2
    expect(layout.innerX).toBe(2);
    expect(layout.innerY).toBe(2);

    renderToBuffer(layout, buffer);
    const lines = buffer.toDebugString().split("\n");

    // Row 0: border
    expect(lines[0]!.charAt(0)).toBe("┌");
    // Row 1: border + padding (empty)
    expect(lines[1]!.charAt(0)).toBe("│");
    // Row 2: border + padding + content
    expect(lines[2]).toContain("Hi");
  });
});
