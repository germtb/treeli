import { describe, expect, it } from "bun:test";
import { Renderer } from "../src/index.ts";
import { type VNode } from "../src/core/vnode.ts";

// Test that JSX compiles and works correctly

function Text({ children, style }: { children?: unknown; style?: Record<string, unknown> }): VNode {
  return <text style={style}>{children}</text>;
}

function Box({ children, x, y }: { children?: VNode | VNode[]; x?: number; y?: number }): VNode {
  return <box x={x} y={y}>{children}</box>;
}

describe("JSX", () => {
  it("renders basic JSX elements", () => {
    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: () => {},
    });

    renderer.render(<text>Hello JSX</text>);

    const buffer = renderer.getCurrentBuffer();
    expect(buffer.toDebugString()).toContain("Hello JSX");
  });

  it("renders nested JSX elements", () => {
    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: () => {},
    });

    renderer.render(
      <box x={0} y={0}>
        <text>Line 1</text>
      </box>
    );

    const buffer = renderer.getCurrentBuffer();
    expect(buffer.toDebugString()).toContain("Line 1");
  });

  it("renders functional components", () => {
    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: () => {},
    });

    renderer.render(<Text style={{ color: "red" }}>Styled</Text>);

    const buffer = renderer.getCurrentBuffer();
    expect(buffer.get(0, 0).char).toBe("S");
    expect(buffer.get(0, 0).style.color).toBe("red");
  });

  it("renders fragments", () => {
    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: () => {},
    });

    renderer.render(
      <>
        <text>First</text>
        <text>Second</text>
      </>
    );

    const debug = renderer.getCurrentBuffer().toDebugString();
    expect(debug).toContain("First");
    expect(debug).toContain("Second");
  });

  it("handles dynamic content", () => {
    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: () => {},
    });

    const count = 42;
    renderer.render(<text>Count: {count}</text>);

    const buffer = renderer.getCurrentBuffer();
    expect(buffer.toDebugString()).toContain("Count: 42");
  });

  it("renders complex component trees", () => {
    function Counter({ value }: { value: number }) {
      return (
        <Box x={0} y={0}>
          <Text style={{ color: value > 0 ? "green" : "red" }}>
            Value: {value}
          </Text>
        </Box>
      );
    }

    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: () => {},
    });

    renderer.render(<Counter value={5} />);

    const buffer = renderer.getCurrentBuffer();
    expect(buffer.toDebugString()).toContain("Value: 5");
    expect(buffer.get(0, 0).style.color).toBe("green");
  });

  it("calls functional components immediately for reactive tracking", () => {
    let renderCount = 0;

    function Expensive({ id }: { id: number }) {
      renderCount++;
      return <text>Item {id}</text>;
    }

    const renderer = new Renderer({
      width: 40,
      height: 10,
      output: () => {},
    });

    renderer.render(<Expensive id={1} />);
    expect(renderCount).toBe(1);

    // Components are called every time JSX is evaluated
    // This is necessary for reactive signal tracking
    renderer.render(<Expensive id={1} />);
    expect(renderCount).toBe(2);

    // Different props also calls the component
    renderer.render(<Expensive id={2} />);
    expect(renderCount).toBe(3);
  });
});
