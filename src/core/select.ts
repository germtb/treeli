/**
 * Select primitive for list selection.
 * Uses signals for state and integrates with the focus manager.
 *
 * Simplified model: navigation directly changes the selection.
 * No separate "focused" vs "selected" state - they are the same.
 *
 * Handles edge cases with dynamic option lists:
 * - preferredIndex: internal unclamped index (where user wants to be)
 * - selectedIndex: computed safe index (clamped to valid range, -1 if empty)
 * - value: derived from selectedIndex (undefined if no options)
 */

import { createSignal, createMemo } from "./reactive.ts";
import {
  registerFocusable,
  unregisterFocusable,
  requestFocus,
  requestBlur,
  type Focusable,
  KEYS,
} from "./focus.ts";

export interface SelectOptions<T = string> {
  /** Initial selected value */
  initialValue?: T;
  /** Called when selection changes */
  onChange?: (value: T | undefined) => void;
  /**
   * Custom keypress handler.
   * Return true to consume the key, false to let it bubble.
   * Called before default handling (Up/Down/Enter/Space).
   */
  onKeypress?: (key: string) => boolean;
  /** Comparison function for values (default: ===) */
  isEqual?: (a: T, b: T) => boolean;
  /**
   * Whether the select participates in focus management (default: true).
   * Set to false for FZF-like patterns where an input is focused
   * but the select handles navigation.
   */
  focusable?: boolean;
}

export interface Select<T = string> extends Focusable {
  // State signals
  /** The currently selected value (undefined if no options) */
  value: () => T | undefined;
  /** The index of the currently selected option (-1 if no options) */
  selectedIndex: () => number;
  /** Whether this select has focus in the focus manager */
  focused: () => boolean;

  // Helpers (reactive)
  /** Check if the given value is currently selected */
  isSelected: (value: T) => boolean;
  /** Check if the given index is currently selected */
  isSelectedIndex: (index: number) => boolean;

  // Actions
  /** Set selection by value */
  setValue: (value: T) => void;
  /** Set selection by index */
  setIndex: (index: number) => void;
  /** Select the next option */
  next: () => void;
  /** Select the previous option */
  prev: () => void;

  // Focus management
  focus: () => void;
  blur: () => void;
  dispose: () => void;
  handleKey: (key: string) => boolean;

  /** @internal - set option count for navigation bounds */
  _setOptionCount: (count: number) => void;
  /** @internal - get option values */
  _getOptionValues: () => T[];
  /** @internal - register option value at index */
  _registerOption: (index: number, value: T) => void;
  /** @internal - clear registered options (called before re-render) */
  _clearOptions: () => void;
}

/**
 * Create a select primitive with reactive state.
 *
 * Navigation directly changes the selection - no separate "highlight" state.
 * Handles dynamic option lists gracefully (empty lists → undefined value).
 *
 * @example
 * ```tsx
 * const sel = createSelect({ initialValue: "a" });
 *
 * function MySelect() {
 *   return (
 *     <select select={sel} pointer={<text color="cyan">❯</text>}>
 *       <option value="a">Option A</option>
 *       <option value="b">Option B</option>
 *     </select>
 *   );
 * }
 *
 * // Access current value (undefined if no options)
 * console.log(sel.value());
 *
 * // Navigate (and select) next option
 * sel.next();
 * ```
 */
export function createSelect<T = string>(options: SelectOptions<T> = {}): Select<T> {
  const {
    initialValue,
    onChange,
    onKeypress,
    isEqual = (a, b) => a === b,
    focusable: shouldRegisterFocusable = true,
  } = options;

  // Internal: preferred index (unclamped, may be out of bounds)
  const [preferredIndex, setPreferredIndex] = createSignal(0);
  const [focused, setFocused] = createSignal(false);
  const [optionCount, setOptionCount] = createSignal(0);

  // Track registered option values
  const optionValues: Map<number, T> = new Map();

  // Track last emitted value for onChange deduplication
  let lastEmittedValue: T | undefined = initialValue;

  // Track whether initial value has been applied
  let initialValueApplied = false;

  // Computed: safe index bounded to available options, -1 if empty
  const selectedIndex = createMemo((): number => {
    const count = optionCount();
    if (count === 0) return -1;
    const pref = preferredIndex();
    return Math.max(0, Math.min(pref, count - 1));
  });

  // Computed: current value derived from selectedIndex
  const value = createMemo((): T | undefined => {
    const idx = selectedIndex();
    if (idx === -1) return undefined;
    return optionValues.get(idx);
  });

  // Helper to emit onChange if value changed
  const emitChange = () => {
    const currentValue = value();
    if (currentValue !== lastEmittedValue) {
      lastEmittedValue = currentValue;
      onChange?.(currentValue);
    }
  };

  // Set selection by value
  const setValue = (newValue: T) => {
    // Find the index for this value
    for (const [idx, val] of optionValues.entries()) {
      if (isEqual(val, newValue)) {
        setPreferredIndex(idx);
        emitChange();
        return;
      }
    }
    // Value not found - don't change
  };

  // Set selection by index
  const setIndex = (index: number) => {
    setPreferredIndex(index);
    emitChange();
  };

  // Navigate to next option
  const next = () => {
    const count = optionCount();
    if (count === 0) return;
    const current = selectedIndex();
    const newIndex = current === -1 ? 0 : Math.min(current + 1, count - 1);
    setPreferredIndex(newIndex);
    emitChange();
  };

  // Navigate to previous option
  const prev = () => {
    const count = optionCount();
    if (count === 0) return;
    const current = selectedIndex();
    const newIndex = current === -1 ? 0 : Math.max(current - 1, 0);
    setPreferredIndex(newIndex);
    emitChange();
  };

  const isSelected = (v: T): boolean => {
    const current = value();
    return current !== undefined && isEqual(current, v);
  };

  const isSelectedIndex = (index: number): boolean => {
    return selectedIndex() === index;
  };

  const handleKey = (key: string): boolean => {
    if (!focused()) return false;

    // Custom handler first
    if (onKeypress) {
      const consumed = onKeypress(key);
      if (consumed) return true;
    }

    // Default navigation (directly changes selection)
    switch (key) {
      case KEYS.UP:
      case KEYS.CTRL_P: // emacs-style up
      case KEYS.CTRL_K: // fzf-style up
      case "k": // vim-style up
        prev();
        return true;
      case KEYS.DOWN:
      case KEYS.CTRL_N: // emacs-style down
      case KEYS.CTRL_J: // fzf/vim-style down
      case "j": // vim-style down
        next();
        return true;
      case KEYS.HOME:
      case KEYS.HOME_ALT:
      case "g": // vim-style top (gg)
        setIndex(0);
        return true;
      case KEYS.END:
      case KEYS.END_ALT:
      case "G": // vim-style bottom
        setIndex(optionCount() - 1);
        return true;
      // Enter/Space now just confirm (could be used for multi-select in future)
      case KEYS.ENTER:
      case KEYS.SPACE:
        return true;
    }

    return false;
  };

  // Handle initial value by finding its index
  if (initialValue !== undefined) {
    // We need to defer this until options are registered
    // For now, set preferredIndex to 0 and let setValue handle it when options are available
  }

  const select: Select<T> = {
    // State signals
    value,
    selectedIndex,
    focused,

    // Helpers
    isSelected,
    isSelectedIndex,

    // Actions
    setValue,
    setIndex,
    next,
    prev,

    // Focus management
    focus: () => requestFocus(select),
    blur: () => requestBlur(select),
    dispose: () => unregisterFocusable(select),
    handleKey,

    // Internal
    _setFocused: setFocused,
    _setOptionCount: (count: number) => {
      setOptionCount(count);
      // Emit change if value changed due to count change
      emitChange();
    },
    _getOptionValues: () => Array.from(optionValues.entries())
      .sort(([a], [b]) => a - b)
      .map(([, v]) => v),
    _registerOption: (index: number, val: T) => {
      optionValues.set(index, val);
      // If this is the initial value and we haven't applied it yet, set preferred index
      if (!initialValueApplied && initialValue !== undefined && isEqual(val, initialValue)) {
        setPreferredIndex(index);
        initialValueApplied = true;
      }
    },
    _clearOptions: () => {
      optionValues.clear();
    },
  };

  // Auto-register with focus manager (unless focusable: false)
  if (shouldRegisterFocusable) {
    registerFocusable(select);
  }

  return select;
}
