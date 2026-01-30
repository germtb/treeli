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
  /** Placeholder text shown when input is empty */
  placeholder?: string;
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
  displayValue: () => string; // handles masking and placeholder
  showingPlaceholder: () => boolean; // true if displaying placeholder text

  // Get current state snapshot
  getState: () => InputState;
}

// ============================================================================
// Composable Input Handlers
// ============================================================================

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
 * Handler for printable characters (insert text at cursor).
 */
function handlePrintable(key: string, state: InputState): InputState | null {
  const { value, cursorPos } = state;
  if (key.length >= 1 && isPrintableText(key)) {
    return {
      value: value.slice(0, cursorPos) + key + value.slice(cursorPos),
      cursorPos: cursorPos + key.length,
    };
  }
  return null;
}

/**
 * Handler for navigation keys (arrows, home/end, word navigation).
 */
function handleNavigation(key: string, state: InputState): InputState | null {
  const { value, cursorPos } = state;

  switch (key) {
    case KEYS.LEFT:
      return { value, cursorPos: Math.max(0, cursorPos - 1) };

    case KEYS.RIGHT:
      return { value, cursorPos: Math.min(value.length, cursorPos + 1) };

    // Word navigation (Alt+Arrow)
    case KEYS.ALT_LEFT:
    case KEYS.ALT_LEFT_CSI: {
      // Move to start of previous word
      let newPos = cursorPos;
      while (newPos > 0 && !isWordChar(value[newPos - 1]!)) newPos--;
      while (newPos > 0 && isWordChar(value[newPos - 1]!)) newPos--;
      return { value, cursorPos: newPos };
    }

    case KEYS.ALT_RIGHT:
    case KEYS.ALT_RIGHT_CSI: {
      // Move to end of next word
      let newPos = cursorPos;
      while (newPos < value.length && !isWordChar(value[newPos]!)) newPos++;
      while (newPos < value.length && isWordChar(value[newPos]!)) newPos++;
      return { value, cursorPos: newPos };
    }

    // Multiline navigation (Up/Down)
    case KEYS.UP: {
      const lineInfo = getLineInfo(value, cursorPos);
      if (lineInfo.lineIndex === 0) return state; // Already on first line
      const prevLineStart = lineInfo.lineStarts[lineInfo.lineIndex - 1]!;
      const prevLineEnd = lineInfo.lineStarts[lineInfo.lineIndex]! - 1;
      const prevLineLength = prevLineEnd - prevLineStart;
      const newPos = prevLineStart + Math.min(lineInfo.column, prevLineLength);
      return { value, cursorPos: newPos };
    }

    case KEYS.DOWN: {
      const lineInfo = getLineInfo(value, cursorPos);
      if (lineInfo.lineIndex >= lineInfo.lineStarts.length - 1) return state;
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
      const lineInfo = getLineInfo(value, cursorPos);
      return { value, cursorPos: lineInfo.lineStarts[lineInfo.lineIndex]! };
    }

    case KEYS.END:
    case KEYS.END_ALT:
    case KEYS.CTRL_E: {
      const lineInfo = getLineInfo(value, cursorPos);
      const lineEnd = lineInfo.lineIndex + 1 < lineInfo.lineStarts.length
        ? lineInfo.lineStarts[lineInfo.lineIndex + 1]! - 1
        : value.length;
      return { value, cursorPos: lineEnd };
    }
  }

  return null;
}

/**
 * Handler for deletion keys (backspace, delete, word delete).
 */
function handleDeletion(key: string, state: InputState): InputState | null {
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

    case KEYS.CTRL_U: {
      // Delete from cursor to start of line
      const lineInfo = getLineInfo(value, cursorPos);
      const lineStart = lineInfo.lineStarts[lineInfo.lineIndex]!;
      return {
        value: value.slice(0, lineStart) + value.slice(cursorPos),
        cursorPos: lineStart,
      };
    }

    case KEYS.CTRL_W:
    case KEYS.ALT_BACKSPACE: {
      // Delete previous word
      if (cursorPos === 0) return state;
      let newPos = cursorPos;
      while (newPos > 0 && !isWordChar(value[newPos - 1]!)) newPos--;
      while (newPos > 0 && isWordChar(value[newPos - 1]!)) newPos--;
      return {
        value: value.slice(0, newPos) + value.slice(cursorPos),
        cursorPos: newPos,
      };
    }
  }

  return null;
}

/**
 * Handler for newline insertion (Enter creates newline).
 * Use this for multiline editors. Not included in defaultInputHandler.
 */
function handleNewline(key: string, state: InputState): InputState | null {
  const { value, cursorPos } = state;

  if (key === KEYS.ENTER || key === KEYS.ENTER_LF || key === KEYS.SHIFT_ENTER) {
    return {
      value: value.slice(0, cursorPos) + "\n" + value.slice(cursorPos),
      cursorPos: cursorPos + 1,
    };
  }

  return null;
}

/**
 * Handler for shift+enter newline only (for inputs where Enter submits).
 * This is what defaultInputHandler uses.
 */
function handleShiftEnterNewline(key: string, state: InputState): InputState | null {
  const { value, cursorPos } = state;

  // Shift+Enter and \n (LF) both insert newline
  if (key === KEYS.SHIFT_ENTER || key === KEYS.ENTER_LF) {
    return {
      value: value.slice(0, cursorPos) + "\n" + value.slice(cursorPos),
      cursorPos: cursorPos + 1,
    };
  }

  return null;
}

/**
 * Composable input handlers.
 * Use these with composeHandlers() to build custom input behavior.
 *
 * @example
 * ```ts
 * // Multiline editor with Enter creating newlines
 * const editor = createInput({
 *   onKeypress: composeHandlers(
 *     inputHandlers.navigation,
 *     inputHandlers.deletion,
 *     inputHandlers.newline,  // Enter creates newline!
 *     inputHandlers.printable,
 *   ),
 * });
 * ```
 */
export const inputHandlers = {
  /** Insert printable characters at cursor */
  printable: handlePrintable,
  /** Arrow keys, home/end, word navigation (Alt+arrows), multiline (Up/Down) */
  navigation: handleNavigation,
  /** Backspace, Delete, Ctrl+W (word), Ctrl+U (to start of line) */
  deletion: handleDeletion,
  /** Enter creates newline (for multiline editors) */
  newline: handleNewline,
  /** Shift+Enter creates newline (for inputs where Enter submits) */
  shiftEnterNewline: handleShiftEnterNewline,
};

/**
 * Compose multiple input handlers into one.
 * Handlers are tried in order until one returns non-null.
 *
 * @example
 * ```ts
 * const myHandler = composeHandlers(
 *   inputHandlers.navigation,
 *   inputHandlers.deletion,
 *   inputHandlers.newline,
 *   inputHandlers.printable,
 * );
 * ```
 */
export function composeHandlers(
  ...handlers: KeypressHandler[]
): KeypressHandler {
  return (key: string, state: InputState): InputState | null => {
    for (const handler of handlers) {
      const result = handler(key, state);
      if (result !== null) {
        return result;
      }
    }
    return null;
  };
}

/**
 * Default input handler implementing standard text editing behavior.
 * Can be used standalone or composed with custom handlers.
 *
 * Supports:
 * - Basic navigation: Left, Right, Home, End
 * - Word navigation: Alt+Left, Alt+Right
 * - Multiline navigation: Up, Down (when text contains newlines)
 * - Deletion: Backspace, Delete, Ctrl+W (word), Ctrl+U (to start of line)
 * - Newline: Shift+Enter inserts newline (Enter is typically for submit)
 *
 * @example
 * ```ts
 * const input = createInput({
 *   onKeypress: (key, state) =>
 *     myCustomHandler(key, state) ?? defaultInputHandler(key, state),
 * });
 * ```
 */
export const defaultInputHandler: KeypressHandler = composeHandlers(
  inputHandlers.navigation,
  inputHandlers.deletion,
  inputHandlers.shiftEnterNewline,
  inputHandlers.printable,
);

// ============================================================================
// Input Primitive
// ============================================================================

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
 * // Multiline editor with Enter creating newlines
 * const editor = createInput({
 *   onKeypress: composeHandlers(
 *     inputHandlers.navigation,
 *     inputHandlers.deletion,
 *     inputHandlers.newline,
 *     inputHandlers.printable,
 *   ),
 * });
 * ```
 */
export function createInput(options: InputOptions = {}): Input {
  const {
    initialValue = "",
    maxLength,
    mask,
    placeholder = "",
    onKeypress = defaultInputHandler,
  } = options;

  const [value, setValueInternal] = createSignal(initialValue);
  const [cursorPos, setCursorPosInternal] = createSignal(initialValue.length);
  const [focused, setFocused] = createSignal(false);

  const clampCursor = (pos: number, len: number) => Math.max(0, Math.min(pos, len));
  const applyMaxLength = (val: string) => (maxLength ? val.slice(0, maxLength) : val);

  const getState = (): InputState => ({
    value: value(),
    cursorPos: cursorPos(),
  });

  const setState = (newState: InputState) => {
    const limitedValue = applyMaxLength(newState.value);
    const clampedCursor = clampCursor(newState.cursorPos, limitedValue.length);
    batch(() => {
      setValueInternal(limitedValue);
      setCursorPosInternal(clampedCursor);
    });
  };

  const handleKey = (key: string): boolean => {
    if (!focused()) return false;

    const currentState = getState();
    const newState = onKeypress(key, currentState);
    if (newState === null) {
      return false; // didn't consume
    }
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
    const val = value();
    if (val.length === 0 && placeholder) {
      return placeholder;
    }
    if (mask) {
      return mask.repeat(val.length);
    }
    return val;
  };

  const showingPlaceholder = () => value().length === 0 && placeholder.length > 0;

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

    // Rendering helpers
    displayValue,
    showingPlaceholder,

    // State snapshot
    getState,

    // Internal
    _setFocused: setFocused,
  };

  // Auto-register with focus manager
  registerFocusable(input);

  return input;
}
