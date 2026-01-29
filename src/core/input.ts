/**
 * Input primitive for text input handling.
 * Uses a monadic onKeypress pattern for full control over key handling.
 *
 * Inputs auto-register with the global focus manager.
 * Only one input can be focused at a time across the app.
 */

import { createSignal, batch } from "./reactive.ts";
import {
  registerFocusable,
  unregisterFocusable,
  requestFocus,
  requestBlur,
  type Focusable,
  KEYS,
} from "./focus.ts";

// Re-export KEYS for convenience
export { KEYS };

/**
 * The state of an input field.
 */
export interface InputState {
  value: string;
  cursorPos: number;
}

/**
 * Keypress handler signature.
 * Return new state to consume the key, or null to let it bubble up.
 */
export type KeypressHandler = (key: string, state: InputState) => InputState | null;

export interface InputOptions {
  /** Initial value */
  initialValue?: string;
  /** Maximum character length */
  maxLength?: number;
  /** Mask character for passwords (e.g., "*") */
  mask?: string;
  /**
   * Custom keypress handler.
   * Return new InputState to consume the key, or null to let it bubble.
   * Use defaultInputHandler for standard text editing behavior.
   */
  onKeypress?: KeypressHandler;
}

export interface Input extends Focusable {
  // Signals (reactive state)
  value: () => string;
  cursorPos: () => number;
  focused: () => boolean;

  // Actions
  handleKey: (key: string) => boolean; // returns true if key was consumed
  focus: () => void;
  blur: () => void;
  setValue: (value: string) => void;
  setCursorPos: (pos: number) => void;
  clear: () => void;

  // Lifecycle
  dispose: () => void; // Unregister from focus manager

  // For rendering
  displayValue: () => string; // handles masking

  // Get current state snapshot
  getState: () => InputState;
}

/**
 * Default input handler implementing standard text editing behavior.
 * Can be used standalone or composed with custom handlers.
 *
 * Supports:
 * - Basic navigation: Left, Right, Home, End
 * - Word navigation: Alt+Left, Alt+Right
 * - Multiline navigation: Up, Down (when text contains newlines)
 * - Deletion: Backspace, Delete, Ctrl+W (word), Ctrl+U (line), Ctrl+K (to end)
 * - Newline: Shift+Enter inserts newline
 *
 * @example
 * ```ts
 * const input = createInput({
 *   onKeypress: (key, state) =>
 *     myCustomHandler(key, state) ?? defaultInputHandler(key, state),
 * });
 * ```
 */
export function defaultInputHandler(key: string, state: InputState): InputState | null {
  const { value, cursorPos } = state;

  switch (key) {
    case KEYS.BACKSPACE:
    case KEYS.BACKSPACE_CTRL_H: {
      if (cursorPos === 0) return state; // consume but no change
      return {
        value: value.slice(0, cursorPos - 1) + value.slice(cursorPos),
        cursorPos: cursorPos - 1,
      };
    }

    case KEYS.DELETE: {
      if (cursorPos >= value.length) return state;
      return {
        value: value.slice(0, cursorPos) + value.slice(cursorPos + 1),
        cursorPos,
      };
    }

    case KEYS.LEFT:
      return { value, cursorPos: Math.max(0, cursorPos - 1) };

    case KEYS.RIGHT:
      return { value, cursorPos: Math.min(value.length, cursorPos + 1) };

    // Word navigation (Alt+Arrow)
    case KEYS.ALT_LEFT:
    case KEYS.ALT_LEFT_CSI: {
      // Move to start of previous word
      let newPos = cursorPos;
      // Skip whitespace/punctuation before cursor
      while (newPos > 0 && !isWordChar(value[newPos - 1]!)) newPos--;
      // Skip word characters
      while (newPos > 0 && isWordChar(value[newPos - 1]!)) newPos--;
      return { value, cursorPos: newPos };
    }

    case KEYS.ALT_RIGHT:
    case KEYS.ALT_RIGHT_CSI: {
      // Move to end of next word
      let newPos = cursorPos;
      // Skip whitespace/punctuation after cursor
      while (newPos < value.length && !isWordChar(value[newPos]!)) newPos++;
      // Skip word characters
      while (newPos < value.length && isWordChar(value[newPos]!)) newPos++;
      return { value, cursorPos: newPos };
    }

    // Multiline navigation (Up/Down)
    case KEYS.UP: {
      const lineInfo = getLineInfo(value, cursorPos);
      if (lineInfo.lineIndex === 0) return state; // Already on first line
      // Move to same column on previous line (or end if shorter)
      const prevLineStart = lineInfo.lineStarts[lineInfo.lineIndex - 1]!;
      const prevLineEnd = lineInfo.lineStarts[lineInfo.lineIndex]! - 1; // before \n
      const prevLineLength = prevLineEnd - prevLineStart;
      const newPos = prevLineStart + Math.min(lineInfo.column, prevLineLength);
      return { value, cursorPos: newPos };
    }

    case KEYS.DOWN: {
      const lineInfo = getLineInfo(value, cursorPos);
      if (lineInfo.lineIndex >= lineInfo.lineStarts.length - 1) return state; // Already on last line
      // Move to same column on next line (or end if shorter)
      const nextLineStart = lineInfo.lineStarts[lineInfo.lineIndex + 1]!;
      const nextLineEnd = lineInfo.lineIndex + 2 < lineInfo.lineStarts.length
        ? lineInfo.lineStarts[lineInfo.lineIndex + 2]! - 1
        : value.length;
      const nextLineLength = nextLineEnd - nextLineStart;
      const newPos = nextLineStart + Math.min(lineInfo.column, nextLineLength);
      return { value, cursorPos: newPos };
    }

    case KEYS.HOME:
    case KEYS.HOME_ALT:
    case KEYS.CTRL_A: {
      // Move to start of current line (or start of text if single line)
      const lineInfo = getLineInfo(value, cursorPos);
      return { value, cursorPos: lineInfo.lineStarts[lineInfo.lineIndex]! };
    }

    case KEYS.END:
    case KEYS.END_ALT:
    case KEYS.CTRL_E: {
      // Move to end of current line (or end of text if single line)
      const lineInfo = getLineInfo(value, cursorPos);
      const lineEnd = lineInfo.lineIndex + 1 < lineInfo.lineStarts.length
        ? lineInfo.lineStarts[lineInfo.lineIndex + 1]! - 1 // before \n
        : value.length;
      return { value, cursorPos: lineEnd };
    }

    case KEYS.CTRL_U:
      // Delete from cursor to start of line
      const lineInfoU = getLineInfo(value, cursorPos);
      const lineStart = lineInfoU.lineStarts[lineInfoU.lineIndex]!;
      return {
        value: value.slice(0, lineStart) + value.slice(cursorPos),
        cursorPos: lineStart,
      };

    case KEYS.CTRL_K:
      // Delete from cursor to end of line
      const lineInfoK = getLineInfo(value, cursorPos);
      const lineEnd = lineInfoK.lineIndex + 1 < lineInfoK.lineStarts.length
        ? lineInfoK.lineStarts[lineInfoK.lineIndex + 1]! - 1
        : value.length;
      return {
        value: value.slice(0, cursorPos) + value.slice(lineEnd),
        cursorPos,
      };

    case KEYS.CTRL_W:
    case KEYS.ALT_BACKSPACE: {
      // Delete previous word
      if (cursorPos === 0) return state;
      let newPos = cursorPos;
      // Skip whitespace/punctuation
      while (newPos > 0 && !isWordChar(value[newPos - 1]!)) newPos--;
      // Skip word characters
      while (newPos > 0 && isWordChar(value[newPos - 1]!)) newPos--;
      return {
        value: value.slice(0, newPos) + value.slice(cursorPos),
        cursorPos: newPos,
      };
    }

    // Shift+Enter inserts newline
    // Different terminals send different sequences:
    // - Ghostty/some terminals: \n (LF)
    // - Kitty (CSI u protocol): \x1b[13;2u
    case KEYS.SHIFT_ENTER:
    case KEYS.ENTER_LF:
      return {
        value: value.slice(0, cursorPos) + "\n" + value.slice(cursorPos),
        cursorPos: cursorPos + 1,
      };

    default:
      // Printable ASCII characters (single char or pasted text)
      if (key.length >= 1 && isPrintableText(key)) {
        return {
          value: value.slice(0, cursorPos) + key + value.slice(cursorPos),
          cursorPos: cursorPos + key.length,
        };
      }
      // Unknown key - don't consume
      return null;
  }
}

/**
 * Check if a string contains only printable ASCII characters.
 */
function isPrintableText(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char < " " || char > "~") {
      return false;
    }
  }
  return true;
}

/**
 * Check if a character is a word character (alphanumeric or underscore).
 */
function isWordChar(char: string): boolean {
  return /\w/.test(char);
}

/**
 * Get line information for a cursor position in multiline text.
 */
function getLineInfo(value: string, cursorPos: number): {
  lineStarts: number[];
  lineIndex: number;
  column: number;
} {
  const lineStarts = [0];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "\n") {
      lineStarts.push(i + 1);
    }
  }

  // Find which line the cursor is on
  let lineIndex = 0;
  for (let i = lineStarts.length - 1; i >= 0; i--) {
    if (cursorPos >= lineStarts[i]!) {
      lineIndex = i;
      break;
    }
  }

  const column = cursorPos - lineStarts[lineIndex]!;

  return { lineStarts, lineIndex, column };
}

/**
 * Create an input primitive with reactive state.
 *
 * @example
 * ```tsx
 * // Basic usage with defaults
 * const input = createInput();
 *
 * // Custom handler
 * const input = createInput({
 *   onKeypress: (key, state) => {
 *     if (key === KEYS.ENTER) { submit(state.value); return { value: "", cursorPos: 0 }; }
 *     if (key === KEYS.ESCAPE) return null; // bubble
 *     if (/^[0-9]$/.test(key) && state.value === "") return null; // let numbers be shortcuts
 *     return defaultInputHandler(key, state);
 *   },
 * });
 *
 * // In your keypress handler:
 * onKeypress(key) {
 *   if (input.handleKey(key)) return; // consumed
 *   // handle other keys...
 * }
 * ```
 */
export function createInput(options: InputOptions = {}): Input {
  const {
    initialValue = "",
    maxLength,
    mask,
    onKeypress = defaultInputHandler,
  } = options;

  const [value, setValueInternal] = createSignal(initialValue);
  const [cursorPos, setCursorPosInternal] = createSignal(initialValue.length);
  const [focused, setFocused] = createSignal(false);

  const clampCursor = (pos: number, len: number) => Math.max(0, Math.min(pos, len));

  const applyMaxLength = (val: string) => (maxLength ? val.slice(0, maxLength) : val);

  const setState = (newState: InputState) => {
    const limitedValue = applyMaxLength(newState.value);
    const clampedCursor = clampCursor(newState.cursorPos, limitedValue.length);
    batch(() => {
      setValueInternal(limitedValue);
      setCursorPosInternal(clampedCursor);
    });
  };

  const getState = (): InputState => ({
    value: value(),
    cursorPos: cursorPos(),
  });

  const handleKey = (key: string): boolean => {
    if (!focused()) return false;

    const currentState = getState();
    const newState = onKeypress(key, currentState);

    if (newState === null) {
      return false; // didn't consume
    }

    // Apply the new state
    setState(newState);
    return true; // consumed
  };

  const setValue = (newValue: string) => {
    const limited = applyMaxLength(newValue);
    batch(() => {
      setValueInternal(limited);
      setCursorPosInternal(clampCursor(cursorPos(), limited.length));
    });
  };

  const setCursorPos = (pos: number) => {
    setCursorPosInternal(clampCursor(pos, value().length));
  };

  const clear = () => {
    batch(() => {
      setValueInternal("");
      setCursorPosInternal(0);
    });
  };

  const displayValue = () => {
    if (mask) {
      return mask.repeat(value().length);
    }
    return value();
  };

  const input: Input = {
    // Signals
    value,
    cursorPos,
    focused,

    // Actions
    handleKey,
    focus: () => requestFocus(input),
    blur: () => requestBlur(input),
    setValue,
    setCursorPos,
    clear,

    // Lifecycle
    dispose: () => unregisterFocusable(input),

    // Rendering helper
    displayValue,

    // State snapshot
    getState,

    // Internal
    _setFocused: setFocused,
  };

  // Auto-register with focus manager
  registerFocusable(input);

  return input;
}
