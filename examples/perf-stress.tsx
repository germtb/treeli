/**
 * Performance stress test
 * Tests rendering performance with rapidly changing content and scrolling.
 *
 * Run with: bun examples/perf-stress.tsx
 */

import { createSignal, createFocusable, run, KEYS } from "../src/index.ts";

// Configuration
const ROWS = 100;        // Total rows of content
const COLS = 80;         // Columns per row
const VISIBLE_ROWS = 20; // Visible viewport
const INITIAL_NOISE = 5; // % of cells that change each frame
const INITIAL_FPS = 60;
const FPS_PRESETS = [30, 60, 120, 240, 500, 1000, 0]; // 0 = uncapped

// Generate random character
function randomChar(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  return chars[Math.floor(Math.random() * chars.length)]!;
}

// Generate a row of content
function generateRow(rowIndex: number): string {
  return `${String(rowIndex).padStart(4, "0")} | ${"█".repeat(COLS - 8)}`;
}

// Generate initial data
function generateInitialData(): string[] {
  const rows: string[] = [];
  for (let i = 0; i < ROWS; i++) {
    rows.push(generateRow(i));
  }
  return rows;
}

// State
const [scrollOffset, setScrollOffset] = createSignal(0);
const [data, setData] = createSignal<string[]>(generateInitialData());
const [frameCount, setFrameCount] = createSignal(0);
const [fps, setFps] = createSignal(0);
const [renderTime, setRenderTime] = createSignal(0);
const [paused, setPaused] = createSignal(false);
const [targetFps, setTargetFps] = createSignal(INITIAL_FPS);
const [noisePercent, setNoisePercent] = createSignal(INITIAL_NOISE);

// FPS tracking
let lastFpsTime = performance.now();
let framesSinceFps = 0;

// Add noise to data (simulate rapidly changing content)
function addNoise() {
  const noise = noisePercent();
  setData((rows) => {
    const newRows = [...rows];
    const cellsToChange = Math.floor((ROWS * COLS * noise) / 100);

    for (let i = 0; i < cellsToChange; i++) {
      const rowIdx = Math.floor(Math.random() * ROWS);
      const colIdx = Math.floor(Math.random() * (COLS - 8)) + 7; // Skip line number
      const row = newRows[rowIdx]!;
      newRows[rowIdx] = row.slice(0, colIdx) + randomChar() + row.slice(colIdx + 1);
    }

    return newRows;
  });
}

// Auto-scroll
function autoScroll() {
  setScrollOffset((offset) => {
    const newOffset = offset + 1;
    return newOffset > ROWS - VISIBLE_ROWS ? 0 : newOffset;
  });
}

// Main loop
let animationInterval: ReturnType<typeof setInterval> | null = null;
let animationFrame: number | null = null;

function runFrame() {
  if (paused()) return;

  const frameStart = performance.now();

  // Update state
  addNoise();
  autoScroll();
  setFrameCount((c) => c + 1);

  // Track render time (approximate - actual render happens in run())
  const frameEnd = performance.now();
  setRenderTime(frameEnd - frameStart);

  // Calculate FPS
  framesSinceFps++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    setFps(framesSinceFps);
    framesSinceFps = 0;
    lastFpsTime = now;
  }
}

function startAnimation() {
  stopAnimation();

  const target = targetFps();

  if (target === 0) {
    // Uncapped mode - use requestAnimationFrame-like loop with setImmediate
    const loop = () => {
      runFrame();
      if (animationFrame !== null) {
        animationFrame = setTimeout(loop, 0) as unknown as number;
      }
    };
    animationFrame = setTimeout(loop, 0) as unknown as number;
  } else {
    // Capped mode - use setInterval
    animationInterval = setInterval(runFrame, 1000 / target);
  }
}

function stopAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
  if (animationFrame !== null) {
    clearTimeout(animationFrame);
    animationFrame = null;
  }
}

function cycleFps(direction: 1 | -1) {
  const current = targetFps();
  const currentIndex = FPS_PRESETS.indexOf(current);
  let newIndex: number;

  if (currentIndex === -1) {
    // Current value not in presets, find closest
    newIndex = direction === 1 ? 0 : FPS_PRESETS.length - 1;
  } else {
    newIndex = (currentIndex + direction + FPS_PRESETS.length) % FPS_PRESETS.length;
  }

  setTargetFps(FPS_PRESETS[newIndex]!);
  startAnimation(); // Restart with new FPS
}

// Create a focusable to handle app shortcuts
const { focusable: appInput } = createFocusable({
  onKey: (key) => {
    switch (key) {
      case "p":
        setPaused((p) => !p);
        return true;
      case KEYS.UP:
        setScrollOffset((o) => Math.max(0, o - 1));
        return true;
      case KEYS.DOWN:
        setScrollOffset((o) => Math.min(ROWS - VISIBLE_ROWS, o + 1));
        return true;
      case "[":
        // Page up (10 rows)
        setScrollOffset((o) => Math.max(0, o - 10));
        return true;
      case "]":
        // Page down (10 rows)
        setScrollOffset((o) => Math.min(ROWS - VISIBLE_ROWS, o + 10));
        return true;
      case "+":
      case "=":
        // Increase target FPS
        cycleFps(1);
        return true;
      case "-":
      case "_":
        // Decrease target FPS
        cycleFps(-1);
        return true;
      case ">":
      case ".":
        // Increase noise
        setNoisePercent((n) => Math.min(100, n + 5));
        return true;
      case "<":
      case ",":
        // Decrease noise
        setNoisePercent((n) => Math.max(0, n - 5));
        return true;
    }
    return false;
  },
});

// Focus the app input
appInput.focus();

function App() {
  const offset = scrollOffset();
  const rows = data();
  const visibleRows = rows.slice(offset, offset + VISIBLE_ROWS);
  const currentFps = fps();
  const currentRenderTime = renderTime();
  const isPaused = paused();
  const target = targetFps();
  const noise = noisePercent();

  return (
    <box direction="column">
      {/* Header with stats */}
      <box direction="row" style={{ color: "cyan", bold: true }}>
        <text>
          FPS: {currentFps.toFixed(0)}/{target === 0 ? "∞" : target} | Render: {currentRenderTime.toFixed(2)}ms |
          Noise: {noise}% | {isPaused ? "PAUSED" : "RUNNING"}
        </text>
      </box>

      {/* Controls */}
      <text style={{ color: "white", dim: true }}>
        p=pause  +/-=fps  &lt;/&gt;=noise  [/]=scroll  Ctrl+C=quit
      </text>

      {/* Separator */}
      <text style={{ color: "white" }}>{"─".repeat(COLS)}</text>

      {/* Content viewport */}
      {visibleRows.map((row, i) => {
        const globalRow = offset + i;
        const isEven = globalRow % 2 === 0;
        return (
          <text
            style={{
              color: isEven ? "green" : "yellow",
              background: globalRow === offset + Math.floor(VISIBLE_ROWS / 2) ? "blue" : undefined
            }}
          >
            {row}
          </text>
        );
      })}

      {/* Separator */}
      <text style={{ color: "white" }}>{"─".repeat(COLS)}</text>

      {/* Footer */}
      <text style={{ color: "white", dim: true }}>
        Rows: {ROWS} | Visible: {VISIBLE_ROWS} | Scroll: {offset}/{ROWS - VISIBLE_ROWS} | Frame: {frameCount()}
      </text>
    </box>
  );
}

run(App);
startAnimation();
