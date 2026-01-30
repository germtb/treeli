/**
 * Focus management system.
 * A framework-global singleton that tracks focusable elements (inputs, buttons, etc).
 *
 * Focusables auto-register when created and coordinate focus through this manager.
 * Only one element can be focused at a time.
 */

import { createSignal, batch } from "./reactive.ts";

/**
 * Common terminal key codes.
 */
export const KEYS = {
  BACKSPACE: "\x7f",
  BACKSPACE_CTRL_H: "\b",
  DELETE: "\x1b[3~",
  LEFT: "\x1b[D",
  RIGHT: "\x1b[C",
  UP: "\x1b[A",
  DOWN: "\x1b[B",
  HOME: "\x1b[H",
  HOME_ALT: "\x1b[1~",
  END: "\x1b[F",
  END_ALT: "\x1b[4~",
  ENTER: "\r",
  ENTER_LF: "\n",
  TAB: "\t",
  SHIFT_TAB: "\x1b[Z",
  ESCAPE: "\x1b",
  CTRL_A: "\x01",
  CTRL_C: "\x03",
  CTRL_D: "\x04",
  CTRL_E: "\x05",
  CTRL_J: "\x0a", // Down alternative (vim/emacs)
  CTRL_K: "\x0b",
  CTRL_L: "\x0c",
  CTRL_N: "\x0e", // Down alternative (emacs)
  CTRL_P: "\x10", // Up alternative (emacs)
  CTRL_U: "\x15",
  CTRL_W: "\x17",
  // Alt+Arrow (word navigation)
  ALT_LEFT: "\x1bb", // Esc+b (macOS/common)
  ALT_LEFT_CSI: "\x1b[1;3D", // CSI sequence
  ALT_RIGHT: "\x1bf", // Esc+f (macOS/common)
  ALT_RIGHT_CSI: "\x1b[1;3C", // CSI sequence
  // Shift+Enter (newline in multiline input)
  SHIFT_ENTER: "\x1b[13;2u", // CSI u protocol (kitty/ghostty)
  // Alt+Backspace (delete word)
  ALT_BACKSPACE: "\x1b\x7f",
  // Space (for buttons)
  SPACE: " ",
} as const;

/**
 * Interface for any focusable element (input, button, etc).
 */
export interface Focusable {
  focused: () => boolean;
  focus: () => void;
  blur: () => void;
  dispose: () => void;
  handleKey: (key: string) => boolean;
  /** @internal */
  _setFocused: (focused: boolean) => void;
}

/**
 * Options for createFocusable.
 */
export interface FocusableOptions {
  /**
   * Key handler. Return true if key was consumed, false to let it bubble.
   */
  onKey: (key: string) => boolean;
  /**
   * Whether to auto-register with focus manager (default: true).
   */
  register?: boolean;
}

/**
 * Create a base focusable with focus management wired up.
 * Use this as the foundation for inputs, buttons, selects, etc.
 *
 * @example
 * ```ts
 * const { focusable, focused, setFocused } = createFocusable({
 *   onKey: (key) => {
 *     if (key === KEYS.ENTER) { doSomething(); return true; }
 *     return false;
 *   },
 * });
 * ```
 */
export function createFocusable(options: FocusableOptions): {
  focusable: Focusable;
  focused: () => boolean;
  setFocused: (focused: boolean) => void;
} {
  const { onKey, register = true } = options;
  const [focused, setFocused] = createSignal(false);

  const handleKey = (key: string): boolean => {
    if (!focused()) return false;
    return onKey(key);
  };

  const focusable: Focusable = {
    focused,
    focus: () => requestFocus(focusable),
    blur: () => requestBlur(focusable),
    dispose: () => unregisterFocusable(focusable),
    handleKey,
    _setFocused: setFocused,
  };

  if (register) {
    registerFocusable(focusable);
  }

  return { focusable, focused, setFocused };
}

// Internal state
const [currentFocused, setCurrentFocused] = createSignal<Focusable | null>(null);
const registeredFocusables: Set<Focusable> = new Set();
let unhandledKeyHandler: ((key: string) => boolean) | null = null;

/**
 * Register a focusable with the focus manager.
 * Called automatically by createInput(), createButton(), etc.
 * @internal
 */
export function registerFocusable(focusable: Focusable): void {
  registeredFocusables.add(focusable);
}

/**
 * Unregister a focusable from the focus manager.
 * Called by focusable.dispose().
 * @internal
 */
export function unregisterFocusable(focusable: Focusable): void {
  registeredFocusables.delete(focusable);
  // If this was the focused element, clear focus
  if (currentFocused() === focusable) {
    setCurrentFocused(null);
  }
}

/**
 * Called when a focusable wants to gain focus.
 * Blurs any currently focused element first.
 * @internal
 */
export function requestFocus(focusable: Focusable): void {
  const current = currentFocused();
  if (current === focusable) return;

  batch(() => {
    // Blur the current element (without triggering requestBlur recursion)
    if (current) {
      current._setFocused(false);
    }
    // Focus the new element
    focusable._setFocused(true);
    setCurrentFocused(focusable);
  });
}

/**
 * Called when a focusable wants to blur.
 * @internal
 */
export function requestBlur(focusable: Focusable): void {
  if (currentFocused() === focusable) {
    batch(() => {
      focusable._setFocused(false);
      setCurrentFocused(null);
    });
  }
}

/**
 * The global focus manager.
 *
 * @example
 * ```tsx
 * import { focus, createInput, createButton, KEYS } from 'treeli';
 *
 * const username = createInput();
 * const submit = createButton({ onPress: () => console.log('Submitted!') });
 *
 * // Focus first element
 * username.focus();
 *
 * // In your keypress handler:
 * onKeypress(key) {
 *   // Focus manager handles Tab/Shift+Tab and routes keys
 *   if (focus.handleKey(key)) return; // consumed
 *
 *   // Handle other app shortcuts...
 * }
 * ```
 */
export const focus = {
  /**
   * Get the currently focused element (reactive signal).
   */
  current: currentFocused,

  /**
   * Focus the next element in registration order.
   * Wraps around to the first element.
   */
  next(): void {
    const focusables = Array.from(registeredFocusables);
    if (focusables.length === 0) return;

    const current = currentFocused();
    if (!current) {
      // No current focus, focus first
      focusables[0]!.focus();
      return;
    }

    const currentIndex = focusables.indexOf(current);
    const nextIndex = (currentIndex + 1) % focusables.length;
    focusables[nextIndex]!.focus();
  },

  /**
   * Focus the previous element in registration order.
   * Wraps around to the last element.
   */
  prev(): void {
    const focusables = Array.from(registeredFocusables);
    if (focusables.length === 0) return;

    const current = currentFocused();
    if (!current) {
      // No current focus, focus last
      focusables[focusables.length - 1]!.focus();
      return;
    }

    const currentIndex = focusables.indexOf(current);
    const prevIndex = (currentIndex - 1 + focusables.length) % focusables.length;
    focusables[prevIndex]!.focus();
  },

  /**
   * Route a keypress to the currently focused element.
   * Automatically handles Tab (next) and Shift+Tab (prev) for focus navigation.
   * If no element consumes the key, calls the unhandled key handler.
   * Returns true if the key was consumed, false otherwise.
   */
  handleKey(key: string): boolean {
    // Handle focus navigation
    if (key === KEYS.TAB) {
      this.next();
      return true;
    }
    if (key === KEYS.SHIFT_TAB) {
      this.prev();
      return true;
    }

    // Route to focused element
    const current = currentFocused();
    if (current && current.handleKey(key)) {
      return true;
    }

    // No focusable consumed it - try unhandled handler
    if (unhandledKeyHandler) {
      return unhandledKeyHandler(key);
    }

    return false;
  },

  /**
   * Set a handler for keys that no focusable element consumes.
   * Useful for global shortcuts like toggling a log viewer.
   * Returns a cleanup function to remove the handler.
   */
  setUnhandledKeyHandler(handler: (key: string) => boolean): () => void {
    unhandledKeyHandler = handler;
    return () => {
      if (unhandledKeyHandler === handler) {
        unhandledKeyHandler = null;
      }
    };
  },

  /**
   * Manually set the focused element.
   * Pass null to blur all elements.
   */
  set(focusable: Focusable | null): void {
    if (focusable === null) {
      const current = currentFocused();
      if (current) {
        current.blur();
      }
    } else {
      focusable.focus();
    }
  },

  /**
   * Get all registered focusable elements.
   */
  getAll(): Focusable[] {
    return Array.from(registeredFocusables);
  },

  /**
   * Clear all registered focusables and handlers.
   * Useful for testing or app reset.
   */
  clear(): void {
    const current = currentFocused();
    if (current) {
      current._setFocused(false);
    }
    setCurrentFocused(null);
    registeredFocusables.clear();
    unhandledKeyHandler = null;
  },
};

// ============================================================================
// Key Sequence Helper
// ============================================================================

/**
 * Options for createKeySequence.
 */
export interface KeySequenceOptions {
  /**
   * Map of key sequences to handlers.
   * Keys are concatenated key strings (e.g., "gg", "dd", "yy").
   */
  sequences: Record<string, () => void>;
  /**
   * Timeout in milliseconds before resetting the sequence buffer.
   * Default: 1000ms
   */
  timeout?: number;
  /**
   * Handler for keys that don't match any sequence prefix.
   * Called with the unmatched key. Return true if consumed.
   */
  onUnmatched?: (key: string) => boolean;
}

/**
 * Create a key sequence handler for multi-key commands.
 * Useful for vim-like keybindings (gg, dd, yy, etc.).
 *
 * @example
 * ```ts
 * const handleKey = createKeySequence({
 *   sequences: {
 *     "gg": () => goToTop(),
 *     "dd": () => deleteLine(),
 *     "yy": () => yankLine(),
 *     "dw": () => deleteWord(),
 *   },
 *   onUnmatched: (key) => {
 *     // Handle single-key commands like 'h', 'j', 'k', 'l'
 *     if (key === "j") { moveDown(); return true; }
 *     return false;
 *   },
 * });
 *
 * // Use in a focusable's onKey handler:
 * const { focusable } = createFocusable({
 *   onKey: handleKey,
 * });
 * ```
 */
export function createKeySequence(options: KeySequenceOptions): (key: string) => boolean {
  const { sequences, timeout = 1000, onUnmatched } = options;

  let buffer = "";
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const resetBuffer = () => {
    buffer = "";
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const startTimeout = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(resetBuffer, timeout);
  };

  // Build a set of valid prefixes for quick lookup
  const validPrefixes = new Set<string>();
  for (const seq of Object.keys(sequences)) {
    for (let i = 1; i <= seq.length; i++) {
      validPrefixes.add(seq.slice(0, i));
    }
  }

  return (key: string): boolean => {
    const newBuffer = buffer + key;

    // Check if this completes a sequence
    if (sequences[newBuffer]) {
      resetBuffer();
      sequences[newBuffer]();
      return true;
    }

    // Check if this is a valid prefix (could lead to a sequence)
    if (validPrefixes.has(newBuffer)) {
      buffer = newBuffer;
      startTimeout();
      return true;
    }

    // Not a valid sequence or prefix - reset and try unmatched handler
    resetBuffer();

    if (onUnmatched) {
      return onUnmatched(key);
    }

    return false;
  };
}

