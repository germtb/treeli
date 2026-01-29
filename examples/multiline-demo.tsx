/**
 * Demo: Multiline text input with focus management
 * Run with: bun examples/multiline-demo.tsx
 */

import {
  createSignal,
  createInput,
  defaultInputHandler,
  focus,
  run,
  KEYS,
} from "../src/index.ts";

// Create a multiline input
const textInput = createInput({
  initialValue: "Type here...\nUse Shift+Enter for newlines",
  onKeypress: (key, state) => {
    // Debug: log what key codes we receive
    if (key.length > 1 || key < " ") {
      console.log("Key:", JSON.stringify(key), "Hex:", Buffer.from(key).toString("hex"));
    }
    return defaultInputHandler(key, state);
  },
});

textInput.focus();

// Render a multiline input field
function MultilineInput(props: {
  label: string;
  input: ReturnType<typeof createInput>;
  width: number;
  minHeight?: number;
}) {
  const { label, input, width, minHeight = 1 } = props;
  const value = input.value();
  const cursor = input.cursorPos();
  const isFocused = input.focused();

  // Split value into lines
  const lines = value.split("\n");

  // Find which line and column the cursor is on
  let cursorLine = 0;
  let cursorCol = 0;
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    if (pos + lines[i]!.length >= cursor) {
      cursorLine = i;
      cursorCol = cursor - pos;
      break;
    }
    pos += lines[i]!.length + 1; // +1 for newline
    if (pos > cursor) {
      cursorLine = i;
      cursorCol = cursor - (pos - lines[i]!.length - 1);
      break;
    }
  }

  // Render all lines
  const renderedLines = lines.map((line, lineIndex) => {
    const displayLine = line.slice(0, width).padEnd(width, " ");

    if (!isFocused) {
      return (
        <text style={{ color: { rgb: [128, 128, 128] } }}>{displayLine}</text>
      );
    }

    if (lineIndex === cursorLine) {
      // This line has the cursor
      const beforeCursor = displayLine.slice(0, cursorCol);
      const cursorChar = displayLine[cursorCol] || " ";
      const afterCursor = displayLine.slice(cursorCol + 1);

      return (
        <box direction="row">
          <text style={{ color: "white" }}>{beforeCursor}</text>
          <text style={{ inverse: true }}>{cursorChar}</text>
          <text style={{ color: "white" }}>{afterCursor}</text>
        </box>
      );
    }

    return <text style={{ color: "white" }}>{displayLine}</text>;
  });

  // Pad with empty lines to reach minHeight
  while (renderedLines.length < minHeight) {
    renderedLines.push(
      <text style={{ color: { rgb: [64, 64, 64] } }}>{" ".repeat(width)}</text>
    );
  }

  return (
    <box direction="column">
      <text style={{ color: "cyan", bold: true }}>{label}</text>
      <box
        direction="column"
        border={true}
        padding={1}
        style={{ color: isFocused ? "white" : { rgb: [128, 128, 128] } }}
      >
        {renderedLines}
      </box>
    </box>
  );
}

function App() {
  const value = textInput.value();
  const lines = value.split("\n");

  return (
    <box direction="column" gap={1} padding={1}>
      <text style={{ color: "yellow", bold: true }}>Multiline Input Demo</text>

      <MultilineInput
        label="Notes"
        input={textInput}
        width={50}
        minHeight={3}
      />

      <box margin={{ top: 1 }}>
        <text style={{ color: { rgb: [128, 128, 128] } }}>
          [Shift+Enter] New line  [Arrow] Navigate  [Alt+Arrow] Word jump  [Ctrl+C] Quit
        </text>
      </box>

      <box margin={{ top: 1 }} direction="column">
        <text style={{ color: { rgb: [100, 100, 100] } }}>
          Lines: {lines.length} | Chars: {value.length} | Cursor: {textInput.cursorPos()}
        </text>
      </box>
    </box>
  );
}

run(App, {
  onKeypress(key) {
    if (focus.handleKey(key)) {
      return; // consumed
    }
  },
});
