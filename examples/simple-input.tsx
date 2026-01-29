/**
 * Minimal input demo for debugging
 * Run with: bun examples/simple-input.tsx
 */

import {
  createInput,
  defaultInputHandler,
  run,
  KEYS,
  createEffect,
} from "../src/index.ts";
import { jsx } from "../src/jsx/jsx-runtime.ts";

const input = createInput();
input.focus();

let renderCount = 0;

function App() {
  renderCount++;

  const val = input.value();
  const cursor = input.cursorPos();
  const display = input.displayValue();

  const beforeCursor = display.slice(0, cursor);
  const cursorChar = display[cursor] || "_";
  const afterCursor = display.slice(cursor + 1);

  return jsx("box", {
    direction: "column",
    children: [
      jsx("text", {
        style: { color: "yellow" },
        children: "Type something (Ctrl+C to quit):",
      }),
      jsx("box", {
        direction: "row",
        children: [
          jsx("text", {
            style: { color: "white" },
            children: beforeCursor,
          }),
          jsx("text", {
            style: { background: "white", color: "black" },
            children: cursorChar,
          }),
          jsx("text", {
            style: { color: "white" },
            children: afterCursor,
          }),
        ],
      }),
      jsx("text", {
        style: { color: "cyan" },
        children: `Value: "${val}" | Cursor: ${cursor} | Renders: ${renderCount}`,
      }),
    ],
  });
}

run(App, {
  onKeypress(key) {
    const before = input.value();
    const handled = input.handleKey(key);
    const after = input.value();

    // Debug: log to stderr so it doesn't mess up the TUI
    console.error(`Key: ${JSON.stringify(key)} | Handled: ${handled} | Before: "${before}" | After: "${after}"`);
  },
});
