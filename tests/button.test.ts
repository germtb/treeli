/**
 * Tests for the createButton primitive.
 */

import { describe, expect, it, beforeEach, mock } from "bun:test";
import { createButton } from "../src/core/button.ts";
import { focus } from "../src/core/focus.ts";
import { KEYS } from "../src/core/input.ts";

describe("createButton", () => {
  beforeEach(() => {
    focus.clear();
  });

  describe("initial state", () => {
    it("starts unfocused", () => {
      const button = createButton();
      expect(button.focused()).toBe(false);
    });
  });

  describe("focus", () => {
    it("can be focused and blurred", () => {
      const button = createButton();
      expect(button.focused()).toBe(false);

      button.focus();
      expect(button.focused()).toBe(true);

      button.blur();
      expect(button.focused()).toBe(false);
    });

    it("registers with focus manager", () => {
      const button = createButton();
      expect(focus.getAll()).toContain(button);
    });

    it("unregisters on dispose", () => {
      const button = createButton();
      expect(focus.getAll()).toContain(button);

      button.dispose();
      expect(focus.getAll()).not.toContain(button);
    });
  });

  describe("press", () => {
    it("calls onPress when Enter is pressed", () => {
      const onPress = mock(() => {});
      const button = createButton({ onPress });
      button.focus();

      button.handleKey(KEYS.ENTER);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("calls onPress when Space is pressed", () => {
      const onPress = mock(() => {});
      const button = createButton({ onPress });
      button.focus();

      button.handleKey(" ");
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("can be pressed programmatically", () => {
      const onPress = mock(() => {});
      const button = createButton({ onPress });

      button.press();
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("does not press when not focused", () => {
      const onPress = mock(() => {});
      const button = createButton({ onPress });
      // not focused

      button.handleKey(KEYS.ENTER);
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe("handleKey", () => {
    it("returns true when key is consumed", () => {
      const button = createButton({ onPress: () => {} });
      button.focus();

      expect(button.handleKey(KEYS.ENTER)).toBe(true);
      expect(button.handleKey(" ")).toBe(true);
    });

    it("returns false for unhandled keys", () => {
      const button = createButton({ onPress: () => {} });
      button.focus();

      expect(button.handleKey("a")).toBe(false);
      expect(button.handleKey(KEYS.LEFT)).toBe(false);
    });

    it("returns false when not focused", () => {
      const button = createButton({ onPress: () => {} });
      expect(button.handleKey(KEYS.ENTER)).toBe(false);
    });
  });

  describe("custom onKeypress", () => {
    it("can handle custom keys", () => {
      const onPress = mock(() => {});
      const customHandler = mock(() => true);

      const button = createButton({
        onPress,
        onKeypress: customHandler,
      });
      button.focus();

      button.handleKey("x");
      expect(customHandler).toHaveBeenCalledWith("x");
      expect(onPress).not.toHaveBeenCalled(); // custom handler consumed it
    });

    it("falls through to default when custom returns false", () => {
      const onPress = mock(() => {});
      const customHandler = mock(() => false);

      const button = createButton({
        onPress,
        onKeypress: customHandler,
      });
      button.focus();

      button.handleKey(KEYS.ENTER);
      expect(customHandler).toHaveBeenCalledWith(KEYS.ENTER);
      expect(onPress).toHaveBeenCalledTimes(1); // fell through to default
    });
  });

  describe("focus manager integration", () => {
    it("works with Tab navigation", () => {
      const button1 = createButton();
      const button2 = createButton();

      button1.focus();
      expect(focus.current()).toBe(button1);

      focus.handleKey(KEYS.TAB);
      expect(focus.current()).toBe(button2);
    });

    it("works mixed with inputs", async () => {
      const { createInput } = await import("../src/core/input.ts");

      const input = createInput();
      const button = createButton();

      input.focus();
      expect(focus.current()).toBe(input);

      focus.next();
      expect(focus.current()).toBe(button);

      focus.next();
      expect(focus.current()).toBe(input);
    });
  });
});
