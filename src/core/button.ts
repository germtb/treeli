/**
 * Button primitive for focusable buttons.
 * Buttons participate in focus management but don't process text input.
 */

import { createSignal } from "./reactive.ts";
import {
  registerFocusable,
  unregisterFocusable,
  requestFocus,
  requestBlur,
  type Focusable,
  KEYS,
} from "./focus.ts";

export interface ButtonOptions {
  /** Called when button is pressed (Enter or Space) */
  onPress?: () => void;
  /**
   * Custom keypress handler.
   * Return true to consume the key, false to let it bubble.
   * By default, Enter and Space trigger onPress.
   */
  onKeypress?: (key: string) => boolean;
}

export interface Button extends Focusable {
  focused: () => boolean;
  focus: () => void;
  blur: () => void;
  dispose: () => void;
  handleKey: (key: string) => boolean;
  /** Programmatically press the button */
  press: () => void;
}

/**
 * Create a button primitive with focus support.
 *
 * @example
 * ```tsx
 * const submitBtn = createButton({
 *   onPress: () => console.log('Submitted!'),
 * });
 *
 * // Render
 * function SubmitButton() {
 *   const isFocused = submitBtn.focused();
 *   return (
 *     <box style={{ background: isFocused ? 'blue' : 'default' }}>
 *       <text style={{ inverse: isFocused }}>[ Submit ]</text>
 *     </box>
 *   );
 * }
 * ```
 */
export function createButton(options: ButtonOptions = {}): Button {
  const { onPress, onKeypress } = options;

  const [focused, setFocused] = createSignal(false);

  const press = () => {
    onPress?.();
  };

  const handleKey = (key: string): boolean => {
    if (!focused()) return false;

    // Custom handler first
    if (onKeypress) {
      const consumed = onKeypress(key);
      if (consumed) return true;
    }

    // Default: Enter or Space presses the button
    if (key === KEYS.ENTER || key === KEYS.SPACE) {
      press();
      return true;
    }

    return false;
  };

  const button: Button = {
    focused,
    focus: () => requestFocus(button),
    blur: () => requestBlur(button),
    dispose: () => unregisterFocusable(button),
    handleKey,
    press,
    _setFocused: setFocused,
  };

  // Auto-register with focus manager
  registerFocusable(button);

  return button;
}
