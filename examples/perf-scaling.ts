/**
 * Scaling test - see how performance changes with grid size
 */

import { Renderer } from "../src/core/renderer.ts";
import { createVNode, createTextNode } from "../src/core/vnode.ts";

console.log("=== Scaling Test ===\n");

for (const size of [50, 100, 200, 300, 400]) {
  const ROWS = size;
  const COLS = size;
  const ITERATIONS = 20;

  function generateTree(frame: number) {
    const rows = [];
    for (let i = 0; i < ROWS; i++) {
      const char = String.fromCharCode(65 + ((i + frame) % 26));
      rows.push(
        createVNode("text", { style: { color: i % 2 === 0 ? "green" : "yellow" } },
          [createTextNode(char.repeat(COLS))])
      );
    }
    return createVNode("box", { direction: "column", width: COLS, height: ROWS }, rows);
  }

  const renderer = new Renderer({ width: COLS, height: ROWS, output: () => {} });

  // Warmup
  for (let i = 0; i < 3; i++) renderer.render(generateTree(i));

  // Benchmark
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    renderer.render(generateTree(i));
  }
  const elapsed = performance.now() - start;
  const perFrame = elapsed / ITERATIONS;
  const fps = 1000 / perFrame;
  const cells = ROWS * COLS;

  console.log(`${size}×${size} (${cells} cells): ${perFrame.toFixed(2)}ms/frame = ${fps.toFixed(0)} FPS`);
}

console.log("\n=== Terminal Output Test ===\n");

// Test with actual terminal output
const REAL_ROWS = 24;
const REAL_COLS = 80;
const REAL_ITERATIONS = 100;

let totalOutputBytes = 0;

function generateRealTree(frame: number) {
  const rows = [];
  for (let i = 0; i < REAL_ROWS; i++) {
    // Simulate realistic content with some changes per frame
    const changing = (i + frame) % 5 === 0;
    const char = changing ? String.fromCharCode(65 + (frame % 26)) : "█";
    rows.push(
      createVNode("text", {
        style: { color: changing ? "cyan" : (i % 2 === 0 ? "green" : "white") }
      }, [createTextNode(char.repeat(REAL_COLS))])
    );
  }
  return createVNode("box", { direction: "column", width: REAL_COLS, height: REAL_ROWS }, rows);
}

const realRenderer = new Renderer({
  width: REAL_COLS,
  height: REAL_ROWS,
  output: (s) => { totalOutputBytes += s.length; }
});

// Warmup
for (let i = 0; i < 5; i++) realRenderer.render(generateRealTree(i));
totalOutputBytes = 0;

// Benchmark with output
const realStart = performance.now();
for (let i = 0; i < REAL_ITERATIONS; i++) {
  realRenderer.render(generateRealTree(i));
}
const realElapsed = performance.now() - realStart;
const realPerFrame = realElapsed / REAL_ITERATIONS;

console.log(`Terminal size (${REAL_COLS}×${REAL_ROWS}):`);
console.log(`  Per frame: ${realPerFrame.toFixed(3)}ms = ${(1000 / realPerFrame).toFixed(0)} FPS`);
console.log(`  Avg output: ${(totalOutputBytes / REAL_ITERATIONS).toFixed(0)} bytes/frame`);
