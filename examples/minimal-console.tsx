#!/usr/bin/env bun
/**
 * Minimal test: Just console capture, no focusables.
 * Run with: bun examples/minimal-console.tsx
 */

import { run } from "../src/index.ts";

function App() {
  return (
    <box padding={1}>
      <text style={{ bold: true, color: "cyan" }}>Minimal Console Test</text>
      <text>Press Ctrl+L to toggle log panel</text>
      <text>Press Ctrl+K to clear logs (when panel visible)</text>
      <text style={{ dim: true }}>Press Ctrl+C to exit</text>
    </box>
  );
}

// Log a message so there's something to see
console.log("App started!");
console.log("This is a test message");
console.log("Press Ctrl+L to see these logs");

run(App);
