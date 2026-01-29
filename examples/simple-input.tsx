/**
 * Minimal input demo for debugging
 * Run with: bun examples/simple-input.tsx
 *
 * Press Ctrl+L to view console logs
 * Press Ctrl+K to clear logs (when log viewer is open)
 */

import {
  createInput,
  defaultInputHandler,
  run,
  KEYS,
  createEffect,
  createSignal,
} from "../src/index.ts";

const input = createInput({ placeholder: "Type something..." });
input.focus();

let renderCount = 0;

function App() {
  renderCount++;

  const val = input.value();
  const cursor = input.cursorPos();

  // Show value with escaped newlines for clarity
  const displayVal = val.replace(/\n/g, "\\n");

  return (
    <box direction="column" gap={1}>
      <text style={{ color: "yellow" }}>
        Type something (Shift+Enter for newlines):
      </text>
      <input input={input} />
      <text style={{ color: "cyan" }}>
        Value: "{displayVal}" | Cursor: {cursor} | Renders: {renderCount}
      </text>
      <text />
      <text style={{ dim: true }}>
        • Ctrl+L to view console logs
      </text>
      <text style={{ dim: true }}>
        • Ctrl+C to quit
      </text>
    </box>
  );
}

run(App, {
  captureConsole: true, // Enable console capture (default: true)
  onKeypress(key) {
    const before = input.value();
    const handled = input.handleKey(key);
    const after = input.value();

    // Log to console - will be captured and viewable with Ctrl+L
    if (handled) {
      console.log(`Key handled: ${JSON.stringify(key)}, value changed from "${before}" to "${after}"`);
    } else {
      console.warn(`Key not handled: ${JSON.stringify(key)}`);
    }
  },
});
