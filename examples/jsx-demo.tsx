/**
 * Demo: JSX syntax demo
 * Run with: bun examples/jsx-demo.tsx
 */

import { Renderer } from "../src/index.ts";

// Functional components with JSX
function Header({ title }: { title: string }) {
  return (
    <box x={0} y={0} width={40} height={1}>
      <text style={{ color: "cyan", bold: true }}>{"═".repeat(3)} {title} {"═".repeat(30 - title.length)}</text>
    </box>
  );
}

function Counter({ value }: { value: number }) {
  const color = value >= 0 ? "green" : "red";
  return (
    <box x={0} y={2}>
      <text style={{ color: color, bold: true }}>Counter: {value}</text>
    </box>
  );
}

function Instructions() {
  return (
    <box x={0} y={4}>
      <text style={{ color: "yellow" }}>[+/-] Change counter  [q] Quit</text>
    </box>
  );
}

function App({ counter }: { counter: number }) {
  return (
    <>
      <Header title="TreeDiff JSX Demo" />
      <Counter value={counter} />
      <Instructions />
    </>
  );
}

// Main
async function main() {
  const renderer = new Renderer({
    width: process.stdout.columns ?? 80,
    height: process.stdout.rows ?? 24,
  });

  let counter = 0;

  // Initial render
  renderer.render(<App counter={counter} />);

  // Set up raw mode for keyboard input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  process.stdin.on("data", (data) => {
    const key = data.toString();

    if (key === "q" || key === "\x03") {
      process.stdout.write("\x1b[2J\x1b[H");
      process.exit(0);
    } else if (key === "+" || key === "=") {
      counter++;
      renderer.render(<App counter={counter} />);
    } else if (key === "-" || key === "_") {
      counter--;
      renderer.render(<App counter={counter} />);
    }
  });

  process.stdout.on("resize", () => {
    renderer.resize(process.stdout.columns ?? 80, process.stdout.rows ?? 24);
    renderer.render(<App counter={counter} />);
  });
}

main().catch(console.error);
