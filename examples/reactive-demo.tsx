/**
 * Demo: Solid.js-style reactive TUI
 * Run with: bun examples/reactive-demo.tsx
 */

import { createSignal, createMemo, run } from "../src/index.ts";

// Counter factory - creates independent counters
function createCounter(initial = 0) {
  const [count, setCount] = createSignal(initial);
  return {
    count,
    increment: () => setCount((c) => c + 1),
    decrement: () => setCount((c) => c - 1),
    reset: () => setCount(initial),
  };
}

// Global state
const counter1 = createCounter(0);
const counter2 = createCounter(100);
const [activeIdx, setActiveIdx] = createSignal(0);
const [showHelp, setShowHelp] = createSignal(false);

// Derived state
const total = createMemo(() => counter1.count() + counter2.count());

// Get active counter
const getActiveCounter = () => (activeIdx() === 0 ? counter1 : counter2);

// App component
function App() {
  const active = activeIdx();
  const helpVisible = showHelp();

  return (
    <box direction="column" width={60} height={15}>
      {/* Header */}
      <box
        direction="row"
        justify="space-between"
        width={50}
        style={{ background: "blue" }}
        padding={{ left: 1, right: 1 }}
      >
        <text style={{ color: "white", bold: true }}>Reactive TUI Demo</text>
        <text style={{ color: "cyan" }}>Total: {total()}</text>
      </box>

      {/* Counters Row */}
      <box direction="row" gap={2} margin={{ top: 1 }}>
        {/* Counter 1 */}
        <box
          border={active === 0 ? "double" : "single"}
          width={20}
          height={3}
          padding={{ left: 1 }}
          style={{ color: active === 0 ? "yellow" : "white" }}
        >
          <text style={{ color: active === 0 ? "green" : "white", bold: active === 0 }}>
            Counter 1: {counter1.count()}
          </text>
        </box>

        {/* Counter 2 */}
        <box
          border={active === 1 ? "double" : "single"}
          width={20}
          height={3}
          padding={{ left: 1 }}
          style={{ color: active === 1 ? "yellow" : "white" }}
        >
          <text style={{ color: active === 1 ? "green" : "white", bold: active === 1 }}>
            Counter 2: {counter2.count()}
          </text>
        </box>
      </box>

      {/* Controls */}
      <box margin={{ top: 1 }}>
        <text style={{ color: "yellow" }}>
          [Tab] Switch  [+/-] Change  [r] Reset  [h] Help  [q] Quit
        </text>
      </box>

      {/* Help Modal - no background color to avoid black cells */}
      {helpVisible && (
        <box position="absolute" x={12} y={4} zIndex={100}>
          <box border="double" width={26} height={7} padding={1} style={{ color: "cyan" }}>
            <text style={{ bold: true }}>Keyboard Shortcuts</text>
            <text>Tab   = Switch counter</text>
            <text>+/-   = Increment/Decrement</text>
            <text>r     = Reset active counter</text>
            <text>h     = Toggle this help</text>
          </box>
        </box>
      )}
    </box>
  );
}

// Run the app
run(App, {
  onKeypress(key) {
    // Debug: uncomment to see key codes
    // console.log("Key:", JSON.stringify(key), "charCode:", key.charCodeAt(0));

    if (key === "q") {
      return true; // Exit
    }

    if (key === "\t") {
      // Tab
      setActiveIdx((i) => (i === 0 ? 1 : 0));
      return;
    }

    if (key === "+" || key === "=") {
      getActiveCounter().increment();
      return;
    }

    if (key === "-" || key === "_") {
      getActiveCounter().decrement();
      return;
    }

    if (key === "r") {
      getActiveCounter().reset();
      return;
    }

    if (key === "h") {
      setShowHelp((s) => !s);
      return;
    }
  },
});
