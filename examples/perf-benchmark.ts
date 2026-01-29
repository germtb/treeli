/**
 * Performance benchmark - measures actual render pipeline timing
 *
 * Run with: bun examples/perf-benchmark.ts
 */

import { Renderer } from "../src/core/renderer.ts";
import { createVNode, createTextNode } from "../src/core/vnode.ts";
import { computeLayout, renderToBuffer } from "../src/core/layout.ts";
import { CellBuffer } from "../src/core/buffer.ts";
import { diffBuffers, findRuns } from "../src/core/diff.ts";
import { runsToAnsi } from "../src/core/ansi.ts";

// Configuration
const WARMUP_ITERATIONS = 10;
const BENCHMARK_ITERATIONS = 100;
const ROWS = 50;
const COLS = 80;

// Generate test VNode tree
function generateTree(frame: number): ReturnType<typeof createVNode> {
  const rows: ReturnType<typeof createVNode>[] = [];

  for (let i = 0; i < ROWS; i++) {
    // Add some variation based on frame and row
    const char = String.fromCharCode(65 + ((i + frame) % 26));
    const content = `Row ${String(i).padStart(3, "0")}: ${char.repeat(COLS - 12)}`;

    rows.push(
      createVNode("text", {
        style: {
          color: i % 2 === 0 ? "green" : "yellow",
          background: i === Math.floor(ROWS / 2) ? "blue" : undefined,
        }
      }, [createTextNode(content)])
    );
  }

  return createVNode("box", { direction: "column", width: COLS, height: ROWS }, rows);
}

// Benchmark helper
function benchmark(name: string, iterations: number, fn: () => void): { avg: number; min: number; max: number } {
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    fn();
  }

  // Benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  return { avg, min, max };
}

function formatResult(name: string, result: { avg: number; min: number; max: number }): string {
  return `${name.padEnd(30)} avg: ${result.avg.toFixed(3)}ms  min: ${result.min.toFixed(3)}ms  max: ${result.max.toFixed(3)}ms`;
}

console.log("=".repeat(80));
console.log("treeli Performance Benchmark");
console.log(`Config: ${ROWS} rows × ${COLS} cols, ${BENCHMARK_ITERATIONS} iterations`);
console.log("=".repeat(80));
console.log("");

// 1. VNode tree creation
const treeCreation = benchmark("VNode tree creation", BENCHMARK_ITERATIONS, () => {
  generateTree(0);
});
console.log(formatResult("1. VNode tree creation", treeCreation));

// 2. Layout computation
const tree = generateTree(0);
const layoutComputation = benchmark("Layout computation", BENCHMARK_ITERATIONS, () => {
  computeLayout(tree, { x: 0, y: 0, width: COLS, height: ROWS });
});
console.log(formatResult("2. Layout computation", layoutComputation));

// 3. Render to buffer
const layout = computeLayout(tree, { x: 0, y: 0, width: COLS, height: ROWS });
const renderToBufferResult = benchmark("Render to buffer", BENCHMARK_ITERATIONS, () => {
  const buffer = new CellBuffer(COLS, ROWS);
  renderToBuffer(layout, buffer);
});
console.log(formatResult("3. Render to buffer", renderToBufferResult));

// 4. Buffer diffing (no changes)
const buffer1 = new CellBuffer(COLS, ROWS);
renderToBuffer(layout, buffer1);
const buffer2 = buffer1.clone();

const diffNoChanges = benchmark("Diff (no changes)", BENCHMARK_ITERATIONS, () => {
  diffBuffers(buffer1, buffer2);
});
console.log(formatResult("4. Diff (no changes)", diffNoChanges));

// 5. Buffer diffing (all changes)
const buffer3 = new CellBuffer(COLS, ROWS);
const tree2 = generateTree(1); // Different frame
const layout2 = computeLayout(tree2, { x: 0, y: 0, width: COLS, height: ROWS });
renderToBuffer(layout2, buffer3);

const diffAllChanges = benchmark("Diff (all changes)", BENCHMARK_ITERATIONS, () => {
  diffBuffers(buffer1, buffer3);
});
console.log(formatResult("5. Diff (all changes)", diffAllChanges));

// 6. Buffer diffing (partial changes - 10%)
const buffer4 = buffer1.clone();
for (let i = 0; i < Math.floor(ROWS * COLS * 0.1); i++) {
  const x = Math.floor(Math.random() * COLS);
  const y = Math.floor(Math.random() * ROWS);
  buffer4.writeString(x, y, "X");
}

const diffPartialChanges = benchmark("Diff (10% changes)", BENCHMARK_ITERATIONS, () => {
  diffBuffers(buffer1, buffer4);
});
console.log(formatResult("6. Diff (10% changes)", diffPartialChanges));

// 7. Find runs
const changes = diffBuffers(buffer1, buffer3);
const findRunsResult = benchmark("Find runs", BENCHMARK_ITERATIONS, () => {
  findRuns(changes);
});
console.log(formatResult("7. Find runs", findRunsResult));

// 8. ANSI generation
const runs = findRuns(changes);
let ansiOutput = "";
const ansiGeneration = benchmark("ANSI generation", BENCHMARK_ITERATIONS, () => {
  ansiOutput = runsToAnsi(runs);
});
console.log(formatResult("8. ANSI generation", ansiGeneration));

// 9. Full render pipeline (Renderer class)
const renderer = new Renderer({
  width: COLS,
  height: ROWS,
  output: () => {}, // Suppress output
});

let frameNum = 0;
const fullPipeline = benchmark("Full render pipeline", BENCHMARK_ITERATIONS, () => {
  const tree = generateTree(frameNum++);
  renderer.render(tree);
});
console.log(formatResult("9. Full render pipeline", fullPipeline));

// 10. Full pipeline with alternating frames (simulates real usage)
frameNum = 0;
const fullPipelineAlternating = benchmark("Full pipeline (alternating)", BENCHMARK_ITERATIONS, () => {
  const tree = generateTree(frameNum % 2);
  renderer.render(tree);
  frameNum++;
});
console.log(formatResult("10. Full pipeline (alternating)", fullPipelineAlternating));

console.log("");
console.log("=".repeat(80));

// Summary
const totalPipeline = treeCreation.avg + layoutComputation.avg + renderToBufferResult.avg + diffPartialChanges.avg + findRunsResult.avg + ansiGeneration.avg;
const theoreticalFps = 1000 / totalPipeline;

console.log("Summary:");
console.log(`  Total pipeline (10% changes): ${totalPipeline.toFixed(3)}ms`);
console.log(`  Theoretical max FPS: ${theoreticalFps.toFixed(0)}`);
console.log(`  Full render (measured): ${fullPipeline.avg.toFixed(3)}ms (${(1000 / fullPipeline.avg).toFixed(0)} FPS)`);
console.log("");

// Identify bottlenecks
const steps = [
  { name: "VNode creation", time: treeCreation.avg },
  { name: "Layout", time: layoutComputation.avg },
  { name: "Render to buffer", time: renderToBufferResult.avg },
  { name: "Diff", time: diffPartialChanges.avg },
  { name: "Find runs", time: findRunsResult.avg },
  { name: "ANSI generation", time: ansiGeneration.avg },
];

steps.sort((a, b) => b.time - a.time);
console.log("Bottlenecks (sorted by time):");
for (const step of steps) {
  const percent = (step.time / totalPipeline * 100).toFixed(1);
  console.log(`  ${step.name.padEnd(20)} ${step.time.toFixed(3)}ms (${percent}%)`);
}

console.log("");
console.log("ANSI output size:", ansiOutput.length, "bytes");
console.log("=".repeat(80));
