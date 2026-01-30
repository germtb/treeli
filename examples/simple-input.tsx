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

// Create an input that logs key presses
const input = createInput({
  placeholder: "Type something...",
  onKeypress: (key, state) => {
    const result = defaultInputHandler(key, state);
    if (result !== null) {
      console.log(`Key handled: ${JSON.stringify(key)}, value changed from "${state.value}" to "${result.value}"`);
    } else {
      console.warn(`Key not handled: ${JSON.stringify(key)}`);
    }
    return result;
  },
});
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
        Ctrl+L to view console logs
      </text>
      <text style={{ dim: true }}>
        Ctrl+C to quit
      </text>
    </box>
  );
}

run(App, {
  captureConsole: true,
});
