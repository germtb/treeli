/**
 * Demo: A simple interactive TUI using our framework.
 * Run with: bun examples/demo.tsx
 */

import { Renderer, type VNode, createVNode, createTextNode } from "../src/index.ts";

// Functional components using the low-level API
// (JSX version below when we verify it works)

function Box(props: { x?: number; y?: number; width?: number; height?: number; title?: string; children?: VNode[] }): VNode {
  const children: VNode[] = [];

  // Add title if provided
  if (props.title) {
    children.push(
      createVNode("__text__", {
        text: `┌─ ${props.title} ─${"─".repeat(Math.max(0, (props.width ?? 20) - props.title.length - 6))}┐`,
        style: { color: "cyan" },
      }, [])
    );
  }

  // Add provided children
  if (props.children) {
    children.push(...props.children);
  }

  return createVNode("box", {
    x: props.x ?? 0,
    y: props.y ?? 0,
    width: props.width ?? 20,
    height: props.height ?? 5,
  }, children);
}

function App(props: { counter: number }): VNode {
  return createVNode("fragment", {}, [
    createVNode(Box, { x: 0, y: 0, width: 30, title: "TreeDiff TUI" }, [
      createVNode("__text__", { text: "Press 'q' to quit", style: { color: "white" } }, []),
    ]),
    createVNode("box", { x: 0, y: 3 }, [
      createVNode("__text__", { text: `Counter: ${props.counter}`, style: { color: "green", bold: true } }, []),
    ]),
    createVNode("box", { x: 0, y: 5 }, [
      createVNode("__text__", { text: "[+] Increment  [-] Decrement", style: { color: "yellow" } }, []),
    ]),
  ]);
}

// Main
async function main() {
  const renderer = new Renderer({
    width: process.stdout.columns ?? 80,
    height: process.stdout.rows ?? 24,
  });

  let counter = 0;

  // Initial render
  renderer.render(createVNode(App, { counter }, []));

  // Set up raw mode for keyboard input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  process.stdin.on("data", (data) => {
    const key = data.toString();

    if (key === "q" || key === "\x03") {
      // q or Ctrl+C
      process.stdout.write("\x1b[2J\x1b[H"); // Clear screen
      process.exit(0);
    } else if (key === "+" || key === "=") {
      counter++;
      renderer.render(createVNode(App, { counter }, []));
    } else if (key === "-" || key === "_") {
      counter--;
      renderer.render(createVNode(App, { counter }, []));
    }
  });

  // Handle resize
  process.stdout.on("resize", () => {
    renderer.resize(process.stdout.columns ?? 80, process.stdout.rows ?? 24);
    renderer.render(createVNode(App, { counter }, []));
  });
}

main().catch(console.error);
