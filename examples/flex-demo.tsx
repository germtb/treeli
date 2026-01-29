/**
 * Demo: Flex layout showcase
 * Run with: bun examples/flex-demo.tsx
 */

import { Renderer } from "../src/index.ts";

function Header() {
  return (
    <box
      direction="row"
      justify="space-between"
      padding={{ left: 1, right: 1 }}
      style={{ background: "blue" }}
      width={60}
      height={3}
    >
      <text style={{ color: "white", bold: true }}>TreeDiff TUI</text>
      <text style={{ color: "cyan" }}>v1.0.0</text>
    </box>
  );
}

function Sidebar({ items }: { items: string[] }) {
  return (
    <box border="rounded" width={15} height={10} padding={1} style={{ color: "cyan" }}>
      {items.map((item, i) => (
        <text style={{ color: i === 0 ? "green" : "white" }}>
          {i === 0 ? "> " : "  "}{item}
        </text>
      ))}
    </box>
  );
}

function Content({ title, body }: { title: string; body: string }) {
  return (
    <box border="single" width={43} height={10} padding={1} style={{ color: "white" }}>
      <text style={{ color: "yellow", bold: true }}>{title}</text>
      <box height={1} />
      <text>{body}</text>
    </box>
  );
}

function StatusBar({ message }: { message: string }) {
  return (
    <box
      direction="row"
      justify="space-between"
      padding={{ left: 1, right: 1 }}
      style={{ background: "green" }}
      width={60}
      height={1}
    >
      <text style={{ color: "black" }}>{message}</text>
      <text style={{ color: "black" }}>Press 'q' to quit</text>
    </box>
  );
}

function Modal({ title, content }: { title: string; content: string }) {
  return (
    <box position="absolute" x={15} y={4} zIndex={100}>
      <box
        border="double"
        width={30}
        height={7}
        padding={1}
        style={{ background: "black", color: "yellow" }}
      >
        <text style={{ color: "white", bold: true }}>{title}</text>
        <box height={1} />
        <text style={{ color: "white" }}>{content}</text>
        <box height={1} />
        <text style={{ color: "cyan" }}>[Enter] OK  [Esc] Cancel</text>
      </box>
    </box>
  );
}

function App({ showModal, counter }: { showModal: boolean; counter: number }) {
  const menuItems = ["Dashboard", "Settings", "Profile", "Help"];

  return (
    <box direction="column">
      <Header />

      <box direction="row" gap={2} margin={{ top: 1 }}>
        <Sidebar items={menuItems} />
        <Content
          title="Dashboard"
          body={`Welcome to TreeDiff TUI!\n\nCounter: ${counter}\n\nUse +/- to change counter\nPress 'm' to toggle modal`}
        />
      </box>

      <box margin={{ top: 1 }}>
        <StatusBar message={`Counter: ${counter}`} />
      </box>

      {showModal && (
        <Modal
          title="Confirm Action"
          content="Are you sure you want to proceed with this action?"
        />
      )}
    </box>
  );
}

async function main() {
  const renderer = new Renderer({
    width: process.stdout.columns ?? 80,
    height: process.stdout.rows ?? 24,
  });

  let counter = 0;
  let showModal = false;

  const render = () => {
    renderer.render(<App showModal={showModal} counter={counter} />);
  };

  render();

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
      render();
    } else if (key === "-" || key === "_") {
      counter--;
      render();
    } else if (key === "m") {
      showModal = !showModal;
      render();
    } else if (key === "\x1b" && showModal) {
      // Escape
      showModal = false;
      render();
    } else if (key === "\r" && showModal) {
      // Enter
      showModal = false;
      render();
    }
  });

  process.stdout.on("resize", () => {
    renderer.resize(process.stdout.columns ?? 80, process.stdout.rows ?? 24);
    render();
  });
}

main().catch(console.error);
