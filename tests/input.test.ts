/**
 * Tests for the createInput primitive.
 */

import { describe, expect, it, mock, beforeEach } from "bun:test";
import {
  createInput,
  defaultInputHandler,
  KEYS,
  type InputState,
} from "../src/core/input.ts";
import { focus } from "../src/core/focus.ts";

describe("createInput", () => {
  beforeEach(() => {
    // Clear focus manager between tests to prevent interference
    focus.clear();
  });
  describe("initial state", () => {
    it("starts with empty value by default", () => {
      const input = createInput();
      expect(input.value()).toBe("");
      expect(input.cursorPos()).toBe(0);
      expect(input.focused()).toBe(false);
    });

    it("starts with initial value", () => {
      const input = createInput({ initialValue: "hello" });
      expect(input.value()).toBe("hello");
      expect(input.cursorPos()).toBe(5); // cursor at end
    });

    it("getState returns current state snapshot", () => {
      const input = createInput({ initialValue: "test" });
      const state = input.getState();
      expect(state.value).toBe("test");
      expect(state.cursorPos).toBe(4);
    });
  });

  describe("focus", () => {
    it("can be focused and blurred", () => {
      const input = createInput();
      expect(input.focused()).toBe(false);

      input.focus();
      expect(input.focused()).toBe(true);

      input.blur();
      expect(input.focused()).toBe(false);
    });

    it("ignores key input when not focused", () => {
      const input = createInput();
      const handled = input.handleKey("a");
      expect(handled).toBe(false);
      expect(input.value()).toBe("");
    });
  });

  describe("character input", () => {
    it("inserts characters at cursor", () => {
      const input = createInput();
      input.focus();

      input.handleKey("h");
      input.handleKey("i");
      expect(input.value()).toBe("hi");
      expect(input.cursorPos()).toBe(2);
    });

    it("inserts in middle of text", () => {
      const input = createInput({ initialValue: "hllo" });
      input.focus();
      // Move cursor to position 1
      input.handleKey(KEYS.HOME);
      input.handleKey(KEYS.RIGHT);
      input.handleKey("e");

      expect(input.value()).toBe("hello");
      expect(input.cursorPos()).toBe(2);
    });

    it("respects maxLength", () => {
      const input = createInput({ maxLength: 5 });
      input.focus();

      "abcdefgh".split("").forEach((c) => input.handleKey(c));

      expect(input.value()).toBe("abcde");
      expect(input.cursorPos()).toBe(5);
    });

    it("handles pasted text (multi-character input)", () => {
      const input = createInput();
      input.focus();

      // Simulate paste by sending multiple characters at once
      input.handleKey("hello world");
      expect(input.value()).toBe("hello world");
      expect(input.cursorPos()).toBe(11);
    });

    it("inserts pasted text at cursor position", () => {
      const input = createInput({ initialValue: "ac" });
      input.focus();
      // Move cursor between 'a' and 'c'
      input.handleKey(KEYS.HOME);
      input.handleKey(KEYS.RIGHT);

      input.handleKey("bb");
      expect(input.value()).toBe("abbc");
      expect(input.cursorPos()).toBe(3);
    });

    it("respects maxLength for pasted text", () => {
      const input = createInput({ maxLength: 5 });
      input.focus();

      input.handleKey("hello world");
      expect(input.value()).toBe("hello");
      expect(input.cursorPos()).toBe(5);
    });
  });

  describe("deletion", () => {
    it("backspace deletes character before cursor", () => {
      const input = createInput({ initialValue: "hello" });
      input.focus();

      input.handleKey(KEYS.BACKSPACE);
      expect(input.value()).toBe("hell");
      expect(input.cursorPos()).toBe(4);
    });

    it("backspace at start consumes but does nothing", () => {
      const input = createInput({ initialValue: "hello" });
      input.focus();
      input.handleKey(KEYS.HOME);

      const handled = input.handleKey(KEYS.BACKSPACE);
      expect(handled).toBe(true); // consumed
      expect(input.value()).toBe("hello"); // no change
      expect(input.cursorPos()).toBe(0);
    });

    it("delete removes character at cursor", () => {
      const input = createInput({ initialValue: "hello" });
      input.focus();
      input.handleKey(KEYS.HOME);

      input.handleKey(KEYS.DELETE);
      expect(input.value()).toBe("ello");
      expect(input.cursorPos()).toBe(0);
    });

    it("delete at end consumes but does nothing", () => {
      const input = createInput({ initialValue: "hello" });
      input.focus();

      const handled = input.handleKey(KEYS.DELETE);
      expect(handled).toBe(true); // consumed
      expect(input.value()).toBe("hello"); // no change
    });

    it("Ctrl+W deletes word backward", () => {
      const input = createInput({ initialValue: "hello world" });
      input.focus();

      input.handleKey(KEYS.CTRL_W);
      expect(input.value()).toBe("hello ");
      expect(input.cursorPos()).toBe(6);

      input.handleKey(KEYS.CTRL_W);
      expect(input.value()).toBe("");
      expect(input.cursorPos()).toBe(0);
    });

    it("Ctrl+U clears the line", () => {
      const input = createInput({ initialValue: "hello world" });
      input.focus();

      input.handleKey(KEYS.CTRL_U);
      expect(input.value()).toBe("");
      expect(input.cursorPos()).toBe(0);
    });

    it("Ctrl+K kills to end of line", () => {
      const input = createInput({ initialValue: "hello world" });
      input.focus();
      // Move to middle
      input.handleKey(KEYS.HOME);
      for (let i = 0; i < 5; i++) input.handleKey(KEYS.RIGHT);

      input.handleKey(KEYS.CTRL_K);
      expect(input.value()).toBe("hello");
      expect(input.cursorPos()).toBe(5);
    });
  });

  describe("cursor movement", () => {
    it("left arrow moves cursor left", () => {
      const input = createInput({ initialValue: "hello" });
      input.focus();

      input.handleKey(KEYS.LEFT);
      expect(input.cursorPos()).toBe(4);

      input.handleKey(KEYS.LEFT);
      expect(input.cursorPos()).toBe(3);
    });

    it("left arrow stops at start", () => {
      const input = createInput({ initialValue: "hi" });
      input.focus();

      input.handleKey(KEYS.LEFT);
      input.handleKey(KEYS.LEFT);
      input.handleKey(KEYS.LEFT);
      input.handleKey(KEYS.LEFT);

      expect(input.cursorPos()).toBe(0);
    });

    it("right arrow moves cursor right", () => {
      const input = createInput({ initialValue: "hello" });
      input.focus();
      input.handleKey(KEYS.HOME);

      input.handleKey(KEYS.RIGHT);
      expect(input.cursorPos()).toBe(1);
    });

    it("right arrow stops at end", () => {
      const input = createInput({ initialValue: "hi" });
      input.focus();

      input.handleKey(KEYS.RIGHT);
      input.handleKey(KEYS.RIGHT);

      expect(input.cursorPos()).toBe(2);
    });

    it("Home moves to start", () => {
      const input = createInput({ initialValue: "hello" });
      input.focus();

      input.handleKey(KEYS.HOME);
      expect(input.cursorPos()).toBe(0);
    });

    it("End moves to end", () => {
      const input = createInput({ initialValue: "hello" });
      input.focus();
      input.handleKey(KEYS.HOME);

      input.handleKey(KEYS.END);
      expect(input.cursorPos()).toBe(5);
    });

    it("Ctrl+A moves to start", () => {
      const input = createInput({ initialValue: "hello" });
      input.focus();

      input.handleKey(KEYS.CTRL_A);
      expect(input.cursorPos()).toBe(0);
    });

    it("Ctrl+E moves to end", () => {
      const input = createInput({ initialValue: "hello" });
      input.focus();
      input.handleKey(KEYS.HOME);

      input.handleKey(KEYS.CTRL_E);
      expect(input.cursorPos()).toBe(5);
    });

    it("setCursorPos sets cursor programmatically", () => {
      const input = createInput({ initialValue: "hello" });
      input.setCursorPos(2);
      expect(input.cursorPos()).toBe(2);
    });

    it("setCursorPos clamps to valid range", () => {
      const input = createInput({ initialValue: "hello" });
      input.setCursorPos(100);
      expect(input.cursorPos()).toBe(5);
      input.setCursorPos(-5);
      expect(input.cursorPos()).toBe(0);
    });
  });

  describe("setValue and clear", () => {
    it("setValue updates value programmatically", () => {
      const input = createInput();
      input.setValue("new value");

      expect(input.value()).toBe("new value");
    });

    it("setValue respects maxLength", () => {
      const input = createInput({ maxLength: 5 });
      input.setValue("hello world");

      expect(input.value()).toBe("hello");
    });

    it("clear empties the input", () => {
      const input = createInput({ initialValue: "hello" });
      input.clear();

      expect(input.value()).toBe("");
      expect(input.cursorPos()).toBe(0);
    });
  });

  describe("password masking", () => {
    it("displayValue masks with specified character", () => {
      const input = createInput({ initialValue: "secret", mask: "*" });

      expect(input.value()).toBe("secret");
      expect(input.displayValue()).toBe("******");
    });

    it("displayValue returns raw value when no mask", () => {
      const input = createInput({ initialValue: "hello" });

      expect(input.displayValue()).toBe("hello");
    });
  });

  describe("handleKey return value", () => {
    it("returns true for handled keys", () => {
      const input = createInput();
      input.focus();

      expect(input.handleKey("a")).toBe(true);
      expect(input.handleKey(KEYS.LEFT)).toBe(true);
      expect(input.handleKey(KEYS.BACKSPACE)).toBe(true);
    });

    it("returns false for unhandled keys", () => {
      const input = createInput();
      input.focus();

      // UP/DOWN are handled (return state) even on single line
      expect(input.handleKey(KEYS.UP)).toBe(true);
      expect(input.handleKey(KEYS.DOWN)).toBe(true);
      // TAB and ESCAPE are not handled by default
      expect(input.handleKey(KEYS.TAB)).toBe(false);
      expect(input.handleKey(KEYS.ESCAPE)).toBe(false);
    });
  });
});

describe("defaultInputHandler", () => {
  it("returns new state for handled keys", () => {
    const state: InputState = { value: "hello", cursorPos: 5 };
    const result = defaultInputHandler("x", state);
    expect(result).toEqual({ value: "hellox", cursorPos: 6 });
  });

  it("returns null for unhandled keys", () => {
    const state: InputState = { value: "hello", cursorPos: 5 };
    // UP/DOWN return state (consumed) even on single line text
    expect(defaultInputHandler(KEYS.UP, state)).toEqual(state);
    expect(defaultInputHandler(KEYS.DOWN, state)).toEqual(state);
    // TAB and ESCAPE are not handled
    expect(defaultInputHandler(KEYS.TAB, state)).toBeNull();
    expect(defaultInputHandler(KEYS.ESCAPE, state)).toBeNull();
  });
});

describe("custom onKeypress handler", () => {
  it("can skip keys to let them bubble", () => {
    const input = createInput({
      onKeypress: (key, state) => {
        // Don't consume "9" when empty
        if (key === "9" && state.value === "") return null;
        return defaultInputHandler(key, state);
      },
    });
    input.focus();

    // "9" on empty input should not be consumed
    expect(input.handleKey("9")).toBe(false);
    expect(input.value()).toBe("");

    // Type something first
    input.handleKey("a");
    expect(input.value()).toBe("a");

    // Now "9" should be consumed
    expect(input.handleKey("9")).toBe(true);
    expect(input.value()).toBe("a9");
  });

  it("can intercept Enter to submit", () => {
    const submitted = mock((_value: string) => {});

    const input = createInput({
      onKeypress: (key, state) => {
        if (key === KEYS.ENTER) {
          submitted(state.value);
          return { value: "", cursorPos: 0 }; // clear on submit
        }
        return defaultInputHandler(key, state);
      },
    });
    input.focus();

    input.handleKey("h");
    input.handleKey("i");
    input.handleKey(KEYS.ENTER);

    expect(submitted).toHaveBeenCalledWith("hi");
    expect(input.value()).toBe("");
  });

  it("full example with shortcuts and submit", () => {
    let submitted = "";

    const input = createInput({
      onKeypress: (key, state) => {
        // Enter submits and clears
        if (key === KEYS.ENTER) {
          submitted = state.value;
          return { value: "", cursorPos: 0 };
        }
        // Escape bubbles
        if (key === KEYS.ESCAPE) return null;
        // Numbers bubble when empty (for shortcuts)
        if (/^[0-9]$/.test(key) && state.value === "") return null;
        // Everything else: default handling
        return defaultInputHandler(key, state);
      },
    });
    input.focus();

    // Number on empty should bubble
    expect(input.handleKey("5")).toBe(false);

    // Text input works
    input.handleKey("h");
    input.handleKey("i");
    expect(input.value()).toBe("hi");

    // Number after text works
    expect(input.handleKey("5")).toBe(true);
    expect(input.value()).toBe("hi5");

    // Enter submits and clears
    input.handleKey(KEYS.ENTER);
    expect(submitted).toBe("hi5");
    expect(input.value()).toBe("");

    // Escape bubbles
    expect(input.handleKey(KEYS.ESCAPE)).toBe(false);
  });
});

describe("word navigation", () => {
  it("Alt+Left moves to start of previous word", () => {
    const state: InputState = { value: "hello world test", cursorPos: 12 };
    // Cursor is after "world", should move to start of "world"
    const result = defaultInputHandler(KEYS.ALT_LEFT, state);
    expect(result?.cursorPos).toBe(6);

    // Move again to start of "hello"
    const result2 = defaultInputHandler(KEYS.ALT_LEFT, result!);
    expect(result2?.cursorPos).toBe(0);
  });

  it("Alt+Right moves to end of next word", () => {
    const state: InputState = { value: "hello world test", cursorPos: 0 };
    // Cursor at start, should move to end of "hello"
    const result = defaultInputHandler(KEYS.ALT_RIGHT, state);
    expect(result?.cursorPos).toBe(5);

    // Move again to end of "world"
    const result2 = defaultInputHandler(KEYS.ALT_RIGHT, result!);
    expect(result2?.cursorPos).toBe(11);
  });

  it("Alt+Backspace deletes previous word", () => {
    const state: InputState = { value: "hello world", cursorPos: 11 };
    const result = defaultInputHandler(KEYS.ALT_BACKSPACE, state);
    expect(result?.value).toBe("hello ");
    expect(result?.cursorPos).toBe(6);
  });

  it("skips punctuation when navigating words", () => {
    const state: InputState = { value: "foo.bar-baz", cursorPos: 11 };
    // Should skip "baz", "-", "bar"
    const result = defaultInputHandler(KEYS.ALT_LEFT, state);
    expect(result?.cursorPos).toBe(8); // start of "baz"

    const result2 = defaultInputHandler(KEYS.ALT_LEFT, result!);
    expect(result2?.cursorPos).toBe(4); // start of "bar"
  });
});

describe("multiline navigation", () => {
  it("Up moves to same column on previous line", () => {
    const state: InputState = { value: "hello\nworld\ntest", cursorPos: 9 }; // "wor|ld"
    const result = defaultInputHandler(KEYS.UP, state);
    expect(result?.cursorPos).toBe(3); // "hel|lo"
  });

  it("Down moves to same column on next line", () => {
    const state: InputState = { value: "hello\nworld\ntest", cursorPos: 3 }; // "hel|lo"
    const result = defaultInputHandler(KEYS.DOWN, state);
    expect(result?.cursorPos).toBe(9); // "wor|ld"
  });

  it("Up on first line stays put", () => {
    const state: InputState = { value: "hello\nworld", cursorPos: 3 };
    const result = defaultInputHandler(KEYS.UP, state);
    expect(result).toEqual(state);
  });

  it("Down on last line stays put", () => {
    const state: InputState = { value: "hello\nworld", cursorPos: 9 };
    const result = defaultInputHandler(KEYS.DOWN, state);
    expect(result).toEqual(state);
  });

  it("clamps to line end if previous line is shorter", () => {
    const state: InputState = { value: "hi\nworld", cursorPos: 7 }; // "worl|d"
    const result = defaultInputHandler(KEYS.UP, state);
    expect(result?.cursorPos).toBe(2); // "hi|" (end of short line)
  });

  it("Home moves to start of current line", () => {
    const state: InputState = { value: "hello\nworld", cursorPos: 9 };
    const result = defaultInputHandler(KEYS.HOME, state);
    expect(result?.cursorPos).toBe(6); // start of "world"
  });

  it("End moves to end of current line", () => {
    const state: InputState = { value: "hello\nworld", cursorPos: 6 };
    const result = defaultInputHandler(KEYS.END, state);
    expect(result?.cursorPos).toBe(11); // end of "world"
  });

  it("Ctrl+U deletes to start of current line", () => {
    const state: InputState = { value: "hello\nworld", cursorPos: 9 };
    const result = defaultInputHandler(KEYS.CTRL_U, state);
    expect(result?.value).toBe("hello\nld");
    expect(result?.cursorPos).toBe(6);
  });

  it("Ctrl+K deletes to end of current line", () => {
    const state: InputState = { value: "hello\nworld", cursorPos: 8 };
    const result = defaultInputHandler(KEYS.CTRL_K, state);
    expect(result?.value).toBe("hello\nwo");
    expect(result?.cursorPos).toBe(8);
  });
});

describe("Shift+Enter for newline", () => {
  it("inserts newline at cursor", () => {
    const state: InputState = { value: "hello", cursorPos: 5 };
    const result = defaultInputHandler(KEYS.SHIFT_ENTER, state);
    expect(result?.value).toBe("hello\n");
    expect(result?.cursorPos).toBe(6);
  });

  it("inserts newline in middle of text", () => {
    const state: InputState = { value: "helloworld", cursorPos: 5 };
    const result = defaultInputHandler(KEYS.SHIFT_ENTER, state);
    expect(result?.value).toBe("hello\nworld");
    expect(result?.cursorPos).toBe(6);
  });
});
