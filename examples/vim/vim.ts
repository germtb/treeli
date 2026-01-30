/**
 * Vim-like editor primitive for treeli.
 * Demonstrates how to build complex modal behavior using treeli primitives.
 */

import { createSignal, batch } from "../../src/core/reactive.ts";
import {
  registerFocusable,
  unregisterFocusable,
  requestFocus,
  requestBlur,
  type Focusable,
  KEYS,
} from "../../src/core/focus.ts";
import { defaultInputHandler, type InputState } from "../../src/core/input.ts";
import { executeMotion, type Motion, parseMotion, parseDoubleMotion } from "./motions.ts";
import { executeOperator, type Operator, parseOperator } from "./operators.ts";

// Re-export KEYS for convenience
export { KEYS };

/**
 * Vim mode types.
 */
export type VimMode = "normal" | "insert" | "visual" | "operator-pending";

/**
 * Cursor position within the document.
 */
export interface CursorPosition {
  line: number;
  col: number;
}

/**
 * Visual selection range.
 */
export interface VisualSelection {
  start: CursorPosition;
  end: CursorPosition;
}

/**
 * Vim editor state.
 */
export interface VimState {
  lines: string[];
  cursor: CursorPosition;
  mode: VimMode;
  register: string; // yanked text
  visualStart: CursorPosition | null; // start of visual selection
  pendingOperator: Operator | null; // operator waiting for motion
  pendingCount: number; // count prefix (e.g., 3 in 3j)
  pendingKey: string | null; // pending key for multi-key sequences (e.g., 'g' for 'gg')
}

/**
 * Options for creating a vim editor.
 */
export interface VimOptions {
  /** Initial content (lines or string with newlines) */
  initialValue?: string | string[];
  /** Called when content changes */
  onChange?: (lines: string[]) => void;
  /** Called when mode changes */
  onModeChange?: (mode: VimMode) => void;
}

/**
 * Vim editor primitive interface.
 */
export interface Vim extends Focusable {
  // Signals (reactive state)
  lines: () => string[];
  cursor: () => CursorPosition;
  mode: () => VimMode;
  register: () => string;
  visualStart: () => CursorPosition | null;
  focused: () => boolean;

  // Computed values
  value: () => string; // all lines joined with newlines
  currentLine: () => string;
  visualSelection: () => VisualSelection | null;

  // Actions
  handleKey: (key: string) => boolean;
  focus: () => void;
  blur: () => void;
  setValue: (value: string | string[]) => void;
  setCursor: (pos: CursorPosition) => void;
  setMode: (mode: VimMode) => void;

  // Lifecycle
  dispose: () => void;

  // Get current state snapshot
  getState: () => VimState;
}

/**
 * Normalize lines from string or string array.
 */
function normalizeLines(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.length === 0 ? [""] : value;
  }
  const lines = value.split("\n");
  return lines.length === 0 ? [""] : lines;
}

/**
 * Clamp cursor position to valid range within lines.
 */
function clampCursor(cursor: CursorPosition, lines: string[]): CursorPosition {
  const line = Math.max(0, Math.min(cursor.line, lines.length - 1));
  const lineLength = lines[line]?.length ?? 0;
  // In normal mode, cursor can't go past last character
  // In insert mode, it can go one past (for appending)
  const col = Math.max(0, Math.min(cursor.col, Math.max(0, lineLength)));
  return { line, col };
}

/**
 * Clamp cursor for normal mode (can't be past last char).
 */
function clampCursorNormal(cursor: CursorPosition, lines: string[]): CursorPosition {
  const line = Math.max(0, Math.min(cursor.line, lines.length - 1));
  const lineLength = lines[line]?.length ?? 0;
  const col = Math.max(0, Math.min(cursor.col, Math.max(0, lineLength - 1)));
  return { line, col };
}

/**
 * Create a vim editor primitive.
 *
 * @example
 * ```tsx
 * const vim = createVim({ initialValue: "Hello\nWorld" });
 *
 * vim.focus();
 *
 * function App() {
 *   return <VimEditor vim={vim} />;
 * }
 * ```
 */
export function createVim(options: VimOptions = {}): Vim {
  const {
    initialValue = "",
    onChange,
    onModeChange,
  } = options;

  const initialLines = normalizeLines(initialValue);

  // Core state signals
  const [lines, setLinesInternal] = createSignal<string[]>(initialLines);
  const [cursor, setCursorInternal] = createSignal<CursorPosition>({ line: 0, col: 0 });
  const [mode, setModeInternal] = createSignal<VimMode>("normal");
  const [register, setRegister] = createSignal<string>("");
  const [visualStart, setVisualStart] = createSignal<CursorPosition | null>(null);
  const [focused, setFocused] = createSignal(false);
  const [pendingOperator, setPendingOperator] = createSignal<Operator | null>(null);
  const [pendingCount, setPendingCount] = createSignal<number>(0);
  const [pendingKey, setPendingKey] = createSignal<string | null>(null);

  // Computed values
  const value = () => lines().join("\n");
  const currentLine = () => lines()[cursor().line] ?? "";

  const visualSelection = (): VisualSelection | null => {
    const start = visualStart();
    if (!start || mode() !== "visual") return null;
    const end = cursor();

    // Normalize so start is before end
    if (start.line < end.line || (start.line === end.line && start.col <= end.col)) {
      return { start, end };
    }
    return { start: end, end: start };
  };

  // Set lines with cursor clamping and callback
  const setLines = (newLines: string[]) => {
    const normalized = newLines.length === 0 ? [""] : newLines;
    setLinesInternal(normalized);
    // Clamp cursor to new bounds
    setCursorInternal(prev => clampCursor(prev, normalized));
    onChange?.(normalized);
  };

  // Set mode with callback
  const setMode = (newMode: VimMode) => {
    const oldMode = mode();
    if (oldMode === newMode) return;

    batch(() => {
      setModeInternal(newMode);

      // Clear pending state when leaving operator-pending mode
      if (oldMode === "operator-pending") {
        setPendingOperator(null);
        setPendingCount(0);
      }

      // Handle visual mode entry/exit
      if (newMode === "visual" && !visualStart()) {
        setVisualStart(cursor());
      } else if (newMode !== "visual") {
        setVisualStart(null);
      }

      // Clamp cursor when entering normal mode
      if (newMode === "normal") {
        setCursorInternal(prev => clampCursorNormal(prev, lines()));
      }
    });

    onModeChange?.(newMode);
  };

  // Set cursor with clamping
  const setCursor = (pos: CursorPosition) => {
    const clamped = mode() === "normal" || mode() === "visual"
      ? clampCursorNormal(pos, lines())
      : clampCursor(pos, lines());
    setCursorInternal(clamped);
  };

  const setValue = (value: string | string[]) => {
    setLines(normalizeLines(value));
  };

  // Get state snapshot
  const getState = (): VimState => ({
    lines: lines(),
    cursor: cursor(),
    mode: mode(),
    register: register(),
    visualStart: visualStart(),
    pendingOperator: pendingOperator(),
    pendingCount: pendingCount(),
    pendingKey: pendingKey(),
  });

  // Handle insert mode key
  const handleInsertKey = (key: string): boolean => {
    if (key === KEYS.ESCAPE) {
      // Exit insert mode, move cursor back one if possible
      batch(() => {
        setMode("normal");
        const cur = cursor();
        if (cur.col > 0) {
          setCursorInternal({ line: cur.line, col: cur.col - 1 });
        }
      });
      return true;
    }

    const currentLines = [...lines()];
    const cur = cursor();
    const line = currentLines[cur.line] ?? "";

    // Handle special keys
    switch (key) {
      case KEYS.ENTER:
      case KEYS.ENTER_LF: {
        // Split line at cursor and insert new line
        const before = line.slice(0, cur.col);
        const after = line.slice(cur.col);
        currentLines[cur.line] = before;
        currentLines.splice(cur.line + 1, 0, after);
        batch(() => {
          setLinesInternal(currentLines);
          setCursorInternal({ line: cur.line + 1, col: 0 });
        });
        onChange?.(currentLines);
        return true;
      }

      case KEYS.BACKSPACE:
      case KEYS.BACKSPACE_CTRL_H: {
        if (cur.col > 0) {
          // Delete character before cursor
          currentLines[cur.line] = line.slice(0, cur.col - 1) + line.slice(cur.col);
          batch(() => {
            setLinesInternal(currentLines);
            setCursorInternal({ line: cur.line, col: cur.col - 1 });
          });
          onChange?.(currentLines);
        } else if (cur.line > 0) {
          // Join with previous line
          const prevLine = currentLines[cur.line - 1] ?? "";
          const newCol = prevLine.length;
          currentLines[cur.line - 1] = prevLine + line;
          currentLines.splice(cur.line, 1);
          batch(() => {
            setLinesInternal(currentLines);
            setCursorInternal({ line: cur.line - 1, col: newCol });
          });
          onChange?.(currentLines);
        }
        return true;
      }

      case KEYS.DELETE: {
        if (cur.col < line.length) {
          // Delete character at cursor
          currentLines[cur.line] = line.slice(0, cur.col) + line.slice(cur.col + 1);
          setLinesInternal(currentLines);
          onChange?.(currentLines);
        } else if (cur.line < currentLines.length - 1) {
          // Join with next line
          const nextLine = currentLines[cur.line + 1] ?? "";
          currentLines[cur.line] = line + nextLine;
          currentLines.splice(cur.line + 1, 1);
          setLinesInternal(currentLines);
          onChange?.(currentLines);
        }
        return true;
      }

      case KEYS.LEFT: {
        if (cur.col > 0) {
          setCursorInternal({ line: cur.line, col: cur.col - 1 });
        } else if (cur.line > 0) {
          // Move to end of previous line
          const prevLen = currentLines[cur.line - 1]?.length ?? 0;
          setCursorInternal({ line: cur.line - 1, col: prevLen });
        }
        return true;
      }

      case KEYS.RIGHT: {
        if (cur.col < line.length) {
          setCursorInternal({ line: cur.line, col: cur.col + 1 });
        } else if (cur.line < currentLines.length - 1) {
          // Move to start of next line
          setCursorInternal({ line: cur.line + 1, col: 0 });
        }
        return true;
      }

      case KEYS.UP: {
        if (cur.line > 0) {
          const prevLen = currentLines[cur.line - 1]?.length ?? 0;
          setCursorInternal({ line: cur.line - 1, col: Math.min(cur.col, prevLen) });
        }
        return true;
      }

      case KEYS.DOWN: {
        if (cur.line < currentLines.length - 1) {
          const nextLen = currentLines[cur.line + 1]?.length ?? 0;
          setCursorInternal({ line: cur.line + 1, col: Math.min(cur.col, nextLen) });
        }
        return true;
      }

      case KEYS.HOME:
      case KEYS.HOME_ALT:
      case KEYS.CTRL_A: {
        setCursorInternal({ line: cur.line, col: 0 });
        return true;
      }

      case KEYS.END:
      case KEYS.END_ALT:
      case KEYS.CTRL_E: {
        setCursorInternal({ line: cur.line, col: line.length });
        return true;
      }

      default: {
        // Handle printable characters
        if (key.length === 1 && key >= " " && key <= "~") {
          // Insert character at cursor
          currentLines[cur.line] = line.slice(0, cur.col) + key + line.slice(cur.col);
          batch(() => {
            setLinesInternal(currentLines);
            setCursorInternal({ line: cur.line, col: cur.col + 1 });
          });
          onChange?.(currentLines);
          return true;
        }
        // Unknown key - don't consume
        return false;
      }
    }
  };

  // Handle normal mode key
  const handleNormalKey = (key: string): boolean => {
    const currentCount = pendingCount();
    const currentPendingKey = pendingKey();

    // Handle pending key sequences (e.g., gg)
    if (currentPendingKey !== null) {
      setPendingKey(null);
      const doubleMotion = parseDoubleMotion(currentPendingKey, key);
      if (doubleMotion) {
        const count = currentCount || 1;
        setPendingCount(0);
        const cur = cursor();
        const newPos = executeMotion(lines(), cur, { ...doubleMotion, count });
        setCursor(newPos);
        return true;
      }
      // If not a valid double motion, reset and continue processing the current key
      // (but first key is lost - this matches vim behavior)
    }

    // Digit handling for count prefix (except 0 which is motion to line start)
    if (key >= "1" && key <= "9") {
      setPendingCount(currentCount * 10 + parseInt(key, 10));
      return true;
    }
    if (key === "0" && currentCount > 0) {
      setPendingCount(currentCount * 10);
      return true;
    }

    const count = currentCount || 1;

    // Check for keys that start multi-key sequences
    if (key === "g") {
      setPendingKey("g");
      return true;
    }

    // Mode switching keys
    if (key === "i") {
      setPendingCount(0);
      setMode("insert");
      return true;
    }
    if (key === "a") {
      setPendingCount(0);
      batch(() => {
        const cur = cursor();
        const lineLen = currentLine().length;
        if (cur.col < lineLen) {
          setCursorInternal({ line: cur.line, col: cur.col + 1 });
        }
        setMode("insert");
      });
      return true;
    }
    if (key === "I") {
      setPendingCount(0);
      batch(() => {
        // Move to first non-whitespace character
        const line = currentLine();
        let col = 0;
        while (col < line.length && (line[col] === " " || line[col] === "\t")) {
          col++;
        }
        setCursorInternal({ line: cursor().line, col });
        setMode("insert");
      });
      return true;
    }
    if (key === "A") {
      setPendingCount(0);
      batch(() => {
        setCursorInternal({ line: cursor().line, col: currentLine().length });
        setMode("insert");
      });
      return true;
    }
    if (key === "o") {
      setPendingCount(0);
      batch(() => {
        const cur = cursor();
        const newLines = [...lines()];
        newLines.splice(cur.line + 1, 0, "");
        setLinesInternal(newLines);
        setCursorInternal({ line: cur.line + 1, col: 0 });
        setMode("insert");
      });
      return true;
    }
    if (key === "O") {
      setPendingCount(0);
      batch(() => {
        const cur = cursor();
        const newLines = [...lines()];
        newLines.splice(cur.line, 0, "");
        setLinesInternal(newLines);
        setCursorInternal({ line: cur.line, col: 0 });
        setMode("insert");
      });
      return true;
    }
    if (key === "v") {
      setPendingCount(0);
      setMode("visual");
      return true;
    }

    // Try to parse as motion
    const motion = parseMotion(key);
    if (motion) {
      setPendingCount(0);
      const cur = cursor();
      const newPos = executeMotion(lines(), cur, { ...motion, count: motion.count * count });
      setCursor(newPos);
      return true;
    }

    // Try to parse as operator
    const op = parseOperator(key);
    if (op) {
      if (op.type === "x") {
        // x is immediate delete char
        setPendingCount(0);
        const currentLines = [...lines()];
        const cur = cursor();
        let line = currentLines[cur.line] ?? "";
        let yankedText = "";
        if (line.length > 0) {
          for (let i = 0; i < count && cur.col < line.length; i++) {
            yankedText += line[cur.col];
            line = line.slice(0, cur.col) + line.slice(cur.col + 1);
          }
          currentLines[cur.line] = line;
          batch(() => {
            setRegister(yankedText);
            setLinesInternal(currentLines);
            // Clamp cursor if at end of line
            const newLineLen = currentLines[cur.line]!.length;
            if (cur.col >= newLineLen && newLineLen > 0) {
              setCursorInternal({ line: cur.line, col: newLineLen - 1 });
            } else if (newLineLen === 0) {
              setCursorInternal({ line: cur.line, col: 0 });
            }
          });
          onChange?.(currentLines);
        }
        return true;
      }

      if (op.type === "dd") {
        // dd is line delete
        setPendingCount(0);
        const currentLines = [...lines()];
        const cur = cursor();
        const deletedLines: string[] = [];
        const linesToDelete = Math.min(count, currentLines.length);
        for (let i = 0; i < linesToDelete; i++) {
          if (currentLines.length > 1) {
            const deleted = currentLines.splice(cur.line, 1);
            deletedLines.push(...deleted);
          } else {
            // Last line - clear it instead of removing
            deletedLines.push(currentLines[0]!);
            currentLines[0] = "";
          }
        }
        batch(() => {
          setRegister(deletedLines.join("\n") + "\n"); // Mark as line-wise with trailing newline
          setLinesInternal(currentLines);
          // Clamp cursor
          const newLine = Math.min(cur.line, currentLines.length - 1);
          setCursorInternal({ line: newLine, col: 0 });
        });
        onChange?.(currentLines);
        return true;
      }

      if (op.type === "yy") {
        // yy is line yank
        setPendingCount(0);
        const cur = cursor();
        const yankedLines: string[] = [];
        for (let i = 0; i < count && cur.line + i < lines().length; i++) {
          yankedLines.push(lines()[cur.line + i]!);
        }
        setRegister(yankedLines.join("\n") + "\n"); // Mark as line-wise with trailing newline
        return true;
      }

      if (op.type === "p") {
        // p is paste after
        setPendingCount(0);
        const reg = register();
        if (reg) {
          const isLinewise = reg.endsWith("\n");
          const regLines = isLinewise
            ? reg.slice(0, -1).split("\n") // Remove trailing newline before split
            : reg.split("\n");
          const currentLines = [...lines()];
          const cur = cursor();
          // If register contains newlines or is line-wise, do linewise paste
          if (isLinewise || regLines.length > 1) {
            for (let i = 0; i < count; i++) {
              currentLines.splice(cur.line + 1, 0, ...regLines);
            }
            batch(() => {
              setLinesInternal(currentLines);
              setCursorInternal({ line: cur.line + 1, col: 0 });
            });
          } else {
            // Character-wise paste
            const line = currentLines[cur.line] ?? "";
            let newLine = line;
            for (let i = 0; i < count; i++) {
              newLine = newLine.slice(0, cur.col + 1) + reg + newLine.slice(cur.col + 1);
            }
            currentLines[cur.line] = newLine;
            batch(() => {
              setLinesInternal(currentLines);
              setCursorInternal({ line: cur.line, col: cur.col + reg.length * count });
            });
          }
          onChange?.(currentLines);
        }
        return true;
      }

      if (op.type === "P") {
        // P is paste before
        setPendingCount(0);
        const reg = register();
        if (reg) {
          const isLinewise = reg.endsWith("\n");
          const regLines = isLinewise
            ? reg.slice(0, -1).split("\n") // Remove trailing newline before split
            : reg.split("\n");
          const currentLines = [...lines()];
          const cur = cursor();
          if (isLinewise || regLines.length > 1) {
            for (let i = 0; i < count; i++) {
              currentLines.splice(cur.line, 0, ...regLines);
            }
            batch(() => {
              setLinesInternal(currentLines);
              setCursorInternal({ line: cur.line, col: 0 });
            });
          } else {
            const line = currentLines[cur.line] ?? "";
            let newLine = line;
            for (let i = 0; i < count; i++) {
              newLine = newLine.slice(0, cur.col) + reg + newLine.slice(cur.col);
            }
            currentLines[cur.line] = newLine;
            batch(() => {
              setLinesInternal(currentLines);
              setCursorInternal({ line: cur.line, col: cur.col + reg.length * count - 1 });
            });
          }
          onChange?.(currentLines);
        }
        return true;
      }

      // Operators that need a motion (d, y)
      if (op.type === "d" || op.type === "y") {
        batch(() => {
          setPendingOperator(op);
          setPendingCount(count);
          setModeInternal("operator-pending");
        });
        return true;
      }
    }

    setPendingCount(0);
    return false;
  };

  // Handle operator-pending mode key (waiting for motion after d, y, etc.)
  const handleOperatorPendingKey = (key: string): boolean => {
    if (key === KEYS.ESCAPE) {
      batch(() => {
        setPendingOperator(null);
        setPendingCount(0);
        setPendingKey(null);
        setModeInternal("normal");
      });
      return true;
    }

    const op = pendingOperator();
    if (!op) {
      setMode("normal");
      return false;
    }

    const count = pendingCount() || 1;
    const currentPendingKey = pendingKey();

    // Handle pending key sequences (e.g., gg) in operator-pending mode
    if (currentPendingKey !== null) {
      setPendingKey(null);
      const doubleMotion = parseDoubleMotion(currentPendingKey, key);
      if (doubleMotion) {
        // Execute operator with the double motion
        const cur = cursor();
        const endPos = executeMotion(lines(), cur, { ...doubleMotion, count });

        // Normalize range
        const startPos = cur;
        const start = startPos.line < endPos.line || (startPos.line === endPos.line && startPos.col <= endPos.col)
          ? startPos : endPos;
        const end = startPos.line < endPos.line || (startPos.line === endPos.line && startPos.col <= endPos.col)
          ? endPos : startPos;

        if (op.type === "d") {
          // Delete from start to end (line-wise for gg)
          const currentLines = [...lines()];
          const deletedLines: string[] = [];
          for (let i = start.line; i <= end.line; i++) {
            deletedLines.push(currentLines[i]!);
          }
          currentLines.splice(start.line, end.line - start.line + 1);
          if (currentLines.length === 0) {
            currentLines.push("");
          }
          batch(() => {
            setRegister(deletedLines.join("\n") + "\n");
            setLinesInternal(currentLines);
            setCursorInternal(clampCursorNormal({ line: start.line, col: 0 }, currentLines));
            setPendingOperator(null);
            setPendingCount(0);
            setModeInternal("normal");
          });
          onChange?.(currentLines);
          return true;
        }

        if (op.type === "y") {
          // Yank from start to end (line-wise for gg)
          const currentLines = lines();
          const yankedLines: string[] = [];
          for (let i = start.line; i <= end.line; i++) {
            yankedLines.push(currentLines[i]!);
          }
          batch(() => {
            setRegister(yankedLines.join("\n") + "\n");
            setPendingOperator(null);
            setPendingCount(0);
            setModeInternal("normal");
          });
          return true;
        }
      }
      // Invalid double motion - cancel
      batch(() => {
        setPendingOperator(null);
        setPendingCount(0);
        setModeInternal("normal");
      });
      return false;
    }

    // Check for keys that start multi-key sequences
    if (key === "g") {
      setPendingKey("g");
      return true;
    }

    // Check for line-wise operator (dd, yy)
    if (key === "d" && op.type === "d") {
      // dd - delete line
      batch(() => {
        const currentLines = [...lines()];
        const cur = cursor();
        const deletedLines: string[] = [];
        const linesToDelete = Math.min(count, currentLines.length);
        for (let i = 0; i < linesToDelete; i++) {
          if (currentLines.length > 1) {
            const deleted = currentLines.splice(cur.line, 1);
            deletedLines.push(...deleted);
          } else {
            // Last line - clear it instead of removing
            deletedLines.push(currentLines[0]!);
            currentLines[0] = "";
          }
        }
        setRegister(deletedLines.join("\n") + "\n"); // Mark as line-wise
        setLinesInternal(currentLines);
        const newLine = Math.min(cur.line, currentLines.length - 1);
        setCursorInternal({ line: newLine, col: 0 });
        setPendingOperator(null);
        setPendingCount(0);
        setModeInternal("normal");
      });
      onChange?.(lines());
      return true;
    }

    if (key === "y" && op.type === "y") {
      // yy - yank line
      batch(() => {
        const cur = cursor();
        const yankedLines: string[] = [];
        for (let i = 0; i < count && cur.line + i < lines().length; i++) {
          yankedLines.push(lines()[cur.line + i]!);
        }
        setRegister(yankedLines.join("\n") + "\n"); // Mark as line-wise
        setPendingOperator(null);
        setPendingCount(0);
        setModeInternal("normal");
      });
      return true;
    }

    // Try to parse as motion
    const motion = parseMotion(key);
    if (motion) {
      const cur = cursor();
      const endPos = executeMotion(lines(), cur, { ...motion, count: motion.count * count });

      // Normalize range
      const startPos = cur;
      const start = startPos.line < endPos.line || (startPos.line === endPos.line && startPos.col <= endPos.col)
        ? startPos : endPos;
      const end = startPos.line < endPos.line || (startPos.line === endPos.line && startPos.col <= endPos.col)
        ? endPos : startPos;

      // Determine if motion is inclusive or exclusive
      // Most motions are exclusive (don't include destination), but some like $ and e are inclusive
      const inclusiveMotions = ["$", "e"];
      const isInclusive = inclusiveMotions.includes(motion.type);

      if (op.type === "d") {
        // Delete from start to end
        const currentLines = [...lines()];
        let yankedText = "";

        if (start.line === end.line) {
          // Same line deletion
          const line = currentLines[start.line] ?? "";
          const endCol = isInclusive ? end.col + 1 : end.col;
          yankedText = line.slice(start.col, endCol);
          currentLines[start.line] = line.slice(0, start.col) + line.slice(endCol);
        } else {
          // Multi-line deletion
          const startLine = currentLines[start.line] ?? "";
          const endLine = currentLines[end.line] ?? "";
          const lines_between: string[] = [];
          const endCol = isInclusive ? end.col + 1 : end.col;

          // Collect yanked text
          yankedText = startLine.slice(start.col);
          for (let i = start.line + 1; i < end.line; i++) {
            lines_between.push(currentLines[i]!);
          }
          if (lines_between.length > 0) {
            yankedText += "\n" + lines_between.join("\n");
          }
          yankedText += "\n" + endLine.slice(0, endCol);

          // Merge lines
          currentLines[start.line] = startLine.slice(0, start.col) + endLine.slice(endCol);
          currentLines.splice(start.line + 1, end.line - start.line);
        }

        if (currentLines.length === 0) {
          currentLines.push("");
        }

        batch(() => {
          setRegister(yankedText);
          setLinesInternal(currentLines);
          setCursorInternal(clampCursorNormal(start, currentLines));
          setPendingOperator(null);
          setPendingCount(0);
          setModeInternal("normal");
        });
        onChange?.(currentLines);
        return true;
      }

      if (op.type === "y") {
        // Yank from start to end
        const currentLines = lines();
        let yankedText = "";
        const endCol = isInclusive ? end.col + 1 : end.col;

        if (start.line === end.line) {
          const line = currentLines[start.line] ?? "";
          yankedText = line.slice(start.col, endCol);
        } else {
          const startLine = currentLines[start.line] ?? "";
          yankedText = startLine.slice(start.col);
          for (let i = start.line + 1; i < end.line; i++) {
            yankedText += "\n" + currentLines[i];
          }
          const endLine = currentLines[end.line] ?? "";
          yankedText += "\n" + endLine.slice(0, endCol);
        }

        batch(() => {
          setRegister(yankedText);
          setPendingOperator(null);
          setPendingCount(0);
          setModeInternal("normal");
        });
        return true;
      }
    }

    // Unknown key in operator-pending mode - cancel
    batch(() => {
      setPendingOperator(null);
      setPendingCount(0);
      setModeInternal("normal");
    });
    return false;
  };

  // Handle visual mode key
  const handleVisualKey = (key: string): boolean => {
    if (key === KEYS.ESCAPE || key === "v") {
      setMode("normal");
      return true;
    }

    // Try to parse as motion - extends selection
    const motion = parseMotion(key);
    if (motion) {
      const cur = cursor();
      const newPos = executeMotion(lines(), cur, motion);
      setCursor(newPos);
      return true;
    }

    // Visual mode operators
    if (key === "d" || key === "x") {
      // Delete selection
      const sel = visualSelection();
      if (sel) {
        const currentLines = [...lines()];
        let yankedText = "";

        if (sel.start.line === sel.end.line) {
          const line = currentLines[sel.start.line] ?? "";
          yankedText = line.slice(sel.start.col, sel.end.col + 1);
          currentLines[sel.start.line] = line.slice(0, sel.start.col) + line.slice(sel.end.col + 1);
        } else {
          const startLine = currentLines[sel.start.line] ?? "";
          const endLine = currentLines[sel.end.line] ?? "";

          yankedText = startLine.slice(sel.start.col);
          for (let i = sel.start.line + 1; i < sel.end.line; i++) {
            yankedText += "\n" + currentLines[i];
          }
          yankedText += "\n" + endLine.slice(0, sel.end.col + 1);

          currentLines[sel.start.line] = startLine.slice(0, sel.start.col) + endLine.slice(sel.end.col + 1);
          currentLines.splice(sel.start.line + 1, sel.end.line - sel.start.line);
        }

        if (currentLines.length === 0) {
          currentLines.push("");
        }

        batch(() => {
          setRegister(yankedText);
          setLinesInternal(currentLines);
          setCursorInternal(clampCursorNormal(sel.start, currentLines));
          setMode("normal");
        });
        onChange?.(currentLines);
      }
      return true;
    }

    if (key === "y") {
      // Yank selection
      const sel = visualSelection();
      if (sel) {
        const currentLines = lines();
        let yankedText = "";

        if (sel.start.line === sel.end.line) {
          const line = currentLines[sel.start.line] ?? "";
          yankedText = line.slice(sel.start.col, sel.end.col + 1);
        } else {
          const startLine = currentLines[sel.start.line] ?? "";
          yankedText = startLine.slice(sel.start.col);
          for (let i = sel.start.line + 1; i < sel.end.line; i++) {
            yankedText += "\n" + currentLines[i];
          }
          const endLine = currentLines[sel.end.line] ?? "";
          yankedText += "\n" + endLine.slice(0, sel.end.col + 1);
        }

        batch(() => {
          setRegister(yankedText);
          setMode("normal");
        });
      }
      return true;
    }

    return false;
  };

  // Main key handler
  const handleKey = (key: string): boolean => {
    if (!focused()) return false;

    switch (mode()) {
      case "insert":
        return handleInsertKey(key);
      case "normal":
        return handleNormalKey(key);
      case "operator-pending":
        return handleOperatorPendingKey(key);
      case "visual":
        return handleVisualKey(key);
      default:
        return false;
    }
  };

  const vim: Vim = {
    // Signals
    lines,
    cursor,
    mode,
    register,
    visualStart,
    focused,

    // Computed
    value,
    currentLine,
    visualSelection,

    // Actions
    handleKey,
    focus: () => requestFocus(vim),
    blur: () => requestBlur(vim),
    setValue,
    setCursor,
    setMode,

    // Lifecycle
    dispose: () => unregisterFocusable(vim),

    // State snapshot
    getState,

    // Internal
    _setFocused: setFocused,
  };

  // Auto-register with focus manager
  registerFocusable(vim);

  return vim;
}
