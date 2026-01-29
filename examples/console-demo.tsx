/**
 * Demo of console capture feature
 * Run with: bun examples/console-demo.tsx
 *
 * Press Ctrl+L to toggle console log viewer
 * Press Ctrl+K to clear logs (when viewer is open)
 */

import { run, createSignal } from "../src/index.ts";

const [count, setCount] = createSignal(0);

function App() {
  const currentCount = count();

  return (
    <box padding={2} gap={1}>
      <text style={{ color: "cyan", bold: true }}>Console Capture Demo</text>
      <text />

      <text>Count: {currentCount}</text>
      <text />

      <text style={{ dim: true }}>• Press '+' to increment (logs to console)</text>
      <text style={{ dim: true }}>• Press '-' to decrement (logs to console)</text>
      <text style={{ dim: true }}>• Press 'e' to log an error</text>
      <text style={{ dim: true }}>• Press 'w' to log a warning</text>
      <text style={{ dim: true }}>• Press 'i' to log info</text>
      <text />
      <text style={{ color: "yellow", bold: true }}>• Press Ctrl+L to view console logs</text>
      <text style={{ color: "yellow", bold: true }}>• Press Ctrl+K to clear logs (when viewer open)</text>
      <text style={{ dim: true }}>• Press Ctrl+C to quit</text>
    </box>
  );
}

run(App, {
  captureConsole: true,
  onKeypress(key) {
    if (key === "+") {
      setCount(count() + 1);
      console.log(`Incremented count to ${count() + 1}`);
    } else if (key === "-") {
      setCount(count() - 1);
      console.log(`Decremented count to ${count() - 1}`);
    } else if (key === "e") {
      console.error("This is an error message!");
    } else if (key === "w") {
      console.warn("This is a warning message!");
    } else if (key === "i") {
      console.info("This is an info message with data:", { count: count(), timestamp: new Date() });
    }
  },
});
