import { describe, expect, it } from "bun:test";
import {
  createVNode,
  createTextNode,
  fnv1a,
  computeHash,
  expandNode,
  type VNode,
} from "../src/core/vnode.ts";

describe("fnv1a", () => {
  it("produces consistent hashes", () => {
    expect(fnv1a("hello")).toBe(fnv1a("hello"));
    expect(fnv1a("world")).toBe(fnv1a("world"));
  });

  it("produces different hashes for different inputs", () => {
    expect(fnv1a("hello")).not.toBe(fnv1a("world"));
    expect(fnv1a("a")).not.toBe(fnv1a("b"));
  });

  it("handles empty string", () => {
    const hash = fnv1a("");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });
});

describe("createVNode", () => {
  it("creates a VNode with correct properties", () => {
    const node = createVNode("box", { x: 10 }, []);
    expect(node.type).toBe("box");
    expect(node.props.x).toBe(10);
    expect(node.children).toEqual([]);
    expect(typeof node.hash).toBe("string");
  });

  it("computes hash based on content", () => {
    const node1 = createVNode("box", { x: 10 }, []);
    const node2 = createVNode("box", { x: 10 }, []);
    const node3 = createVNode("box", { x: 20 }, []);

    expect(node1.hash).toBe(node2.hash); // Same content = same hash
    expect(node1.hash).not.toBe(node3.hash); // Different props = different hash
  });

  it("includes children in hash (Merkle property)", () => {
    const child1 = createTextNode("A");
    const child2 = createTextNode("B");

    const parent1 = createVNode("box", {}, [child1]);
    const parent2 = createVNode("box", {}, [child2]);

    expect(parent1.hash).not.toBe(parent2.hash);
  });
});

describe("createTextNode", () => {
  it("creates a text node", () => {
    const node = createTextNode("Hello");
    expect(node.type).toBe("__text__");
    expect(node.props.text).toBe("Hello");
  });
});

describe("computeHash", () => {
  it("is stable for object props with different key order", () => {
    const hash1 = computeHash("box", { a: 1, b: 2 }, []);
    const hash2 = computeHash("box", { b: 2, a: 1 }, []);
    expect(hash1).toBe(hash2);
  });

  it("handles nested props", () => {
    const hash1 = computeHash("box", { style: { color: "red", background: "blue" } }, []);
    const hash2 = computeHash("box", { style: { background: "blue", color: "red" } }, []);
    expect(hash1).toBe(hash2);
  });
});

describe("expandNode", () => {
  it("returns intrinsic nodes unchanged (if no children)", () => {
    const node = createVNode("box", { x: 10 }, []);
    const expanded = expandNode(node);
    expect(expanded).toBe(node); // Same reference
  });

  it("expands functional components", () => {
    const MyComponent = (props: { name: string }) => {
      return createVNode("text", { text: `Hello ${props.name}` }, []);
    };

    const node = createVNode(MyComponent, { name: "World" }, []);
    const expanded = expandNode(node);

    expect(expanded.type).toBe("text");
    expect(expanded.props.text).toBe("Hello World");
  });

  it("expands nested functional components", () => {
    const Inner = (props: { value: number }) => {
      return createTextNode(String(props.value));
    };

    const Outer = (props: { multiplier: number }) => {
      return createVNode("box", {}, [
        createVNode(Inner, { value: props.multiplier * 2 }, []),
      ]);
    };

    const node = createVNode(Outer, { multiplier: 5 }, []);
    const expanded = expandNode(node);

    expect(expanded.type).toBe("box");
    expect(expanded.children[0]!.type).toBe("__text__");
    expect(expanded.children[0]!.props.text).toBe("10");
  });

});
