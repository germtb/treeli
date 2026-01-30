/**
 * Vim Editor Demo
 *
 * An interactive demonstration of the vim-like editor built with treeli.
 * Run with: bun examples/vim/demo.tsx
 */

import { run, focus, KEYS } from "../../src/index.ts";
import { createVim, type Vim, type VisualSelection } from "./vim.ts";
import type { VNode } from "../../src/core/vnode.ts";
import type { Color } from "../../src/core/cell.ts";
import type { Style } from "../../src/core/cell.ts";

// Create vim editor with sample content
const vim = createVim({
  initialValue: `Welcome to the Vim Editor Demo!

This is a vim-like editor built with treeli.
Try the following commands:

NAVIGATION:
  h/j/k/l - Move cursor left/down/up/right
  w/b     - Move to next/previous word
  0/$     - Move to start/end of line
  gg/G    - Move to start/end of file

MODE SWITCHING:
  i       - Insert mode (before cursor)
  a       - Insert mode (after cursor)
  o/O     - Insert mode (new line below/above)
  v       - Visual mode
  Escape  - Return to normal mode

EDITING:
  x       - Delete character
  dd      - Delete line
  yy      - Yank (copy) line
  p/P     - Paste after/before
  dw      - Delete word
  d$      - Delete to end of line

Press Ctrl+C to exit.`,
});

// Focus the vim editor
vim.focus();

/**
 * Check if a position is within the visual selection.
 */
function isInSelection(
  lineIndex: number,
  colIndex: number,
  selection: VisualSelection | null
): boolean {
  if (!selection) return false;

  const { start, end } = selection;

  // Single line selection
  if (start.line === end.line) {
    return lineIndex === start.line && colIndex >= start.col && colIndex <= end.col;
  }

  // Multi-line selection
  if (lineIndex === start.line) {
    return colIndex >= start.col;
  }
  if (lineIndex === end.line) {
    return colIndex <= end.col;
  }
  return lineIndex > start.line && lineIndex < end.line;
}

/**
 * Render a line with optional cursor and visual selection highlighting.
 */
function renderLine(
  line: string,
  lineIndex: number,
  cursor: { line: number; col: number },
  mode: string,
  isFocused: boolean,
  selection: VisualSelection | null,
  lineNumWidth: number
): VNode {
  const lineNum = String(lineIndex + 1).padStart(lineNumWidth, " ");
  const isCurrentLine = lineIndex === cursor.line;
  const isVisualMode = mode === "visual";
  const isInsertMode = mode === "insert";

  // If no cursor on this line and no visual selection, render simply
  if (!isCurrentLine && !isVisualMode) {
    return (
      <box direction="row">
        <text style={{ dim: true }}>{lineNum} </text>
        <text>{line || " "}</text>
      </box>
    ) as VNode;
  }

  // For visual mode or cursor line, we need character-by-character rendering
  const chars: VNode[] = [];
  const displayLine = line || " ";

  for (let i = 0; i < displayLine.length; i++) {
    const char = displayLine[i]!;
    const isCursorPos = isCurrentLine && i === cursor.col && isFocused;
    const isSelected = isInSelection(lineIndex, i, selection);

    let style: Style = {};

    if (isCursorPos) {
      if (isInsertMode) {
        // Insert mode: underline cursor (line cursor style)
        style = { underline: true, color: "cyan" };
      } else if (isVisualMode && isSelected) {
        // Visual mode cursor on selected text: inverse + magenta background
        style = { inverse: true, color: "magenta" };
      } else {
        // Normal mode: block cursor (inverse)
        style = { inverse: true };
      }
    } else if (isSelected) {
      // Visual selection: magenta background
      style = { background: "magenta", color: "white" };
    }

    chars.push(<text style={style}>{char}</text> as VNode);
  }

  // Handle cursor at end of line (past last character)
  if (isCurrentLine && cursor.col >= displayLine.length && isFocused) {
    if (isInsertMode) {
      chars.push(<text style={{ underline: true, color: "cyan" }}> </text> as VNode);
    } else {
      chars.push(<text style={{ inverse: true }}> </text> as VNode);
    }
  }

  return (
    <box direction="row">
      <text style={{ dim: true, color: isCurrentLine ? "yellow" : "default" }}>
        {lineNum}{" "}
      </text>
      {chars}
    </box>
  ) as VNode;
}

/**
 * VimEditor component - renders the vim editor with line numbers and cursor.
 */
function VimEditor({ vim }: { vim: Vim }): VNode {
  const lines = vim.lines();
  const cursor = vim.cursor();
  const mode = vim.mode();
  const isFocused = vim.focused();
  const selection = vim.visualSelection();

  // Calculate line number width
  const lineNumWidth = Math.max(2, String(lines.length).length);

  // Render each line
  const lineElements = lines.map((line, lineIndex) =>
    renderLine(line, lineIndex, cursor, mode, isFocused, selection, lineNumWidth)
  );

  // Mode indicator colors
  const getModeColor = (m: string): Color => {
    switch (m) {
      case "normal": return "green";
      case "insert": return "blue";
      case "visual": return "magenta";
      case "operator-pending": return "yellow";
      default: return "white";
    }
  };

  // Truncate register for display
  const reg = vim.register();
  const regDisplay = reg ? reg.replace(/\n/g, "\\n").slice(0, 20) + (reg.length > 20 ? "..." : "") : "";

  return (
    <box direction="column" padding={1}>
      {/* Title bar */}
      <box direction="row" style={{ bold: true, color: "cyan" }}>
        <text>Vim Editor Demo</text>
      </box>

      {/* Editor area */}
      <box border="single" padding={1} style={{ background: "black" }}>
        {lineElements}
      </box>

      {/* Status line */}
      <box direction="row" gap={2} style={{ dim: true }}>
        <text style={{ color: getModeColor(mode), bold: true }}>
          -- {mode.toUpperCase()} --
        </text>
        <text>
          Ln {cursor.line + 1}, Col {cursor.col + 1}
        </text>
        {reg && (
          <text>
            Reg: "{regDisplay}"
          </text>
        )}
        {selection && (
          <text>
            Sel: {selection.start.line + 1}:{selection.start.col + 1} -
            {selection.end.line + 1}:{selection.end.col + 1}
          </text>
        )}
      </box>

      {/* Help text */}
      <text style={{ dim: true }}>
        Press Ctrl+C to exit
      </text>
    </box>
  ) as VNode;
}

/**
 * Main App component.
 */
function App() {
  return <VimEditor vim={vim} />;
}

// Run the app
run(App);
