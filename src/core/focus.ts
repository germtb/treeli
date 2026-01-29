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
  CTRL_K: "\x0b",
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

// Internal state
const [currentFocused, setCurrentFocused] = createSignal<Focusable | null>(null);
const registeredFocusables: Set<Focusable> = new Set();

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
    if (!current) return false;
    return current.handleKey(key);
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
   * Clear all registered focusables.
   * Useful for testing or app reset.
   */
  clear(): void {
    const current = currentFocused();
    if (current) {
      current._setFocused(false);
    }
    setCurrentFocused(null);
    registeredFocusables.clear();
  },
};
