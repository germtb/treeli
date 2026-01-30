/**
 * Tests for focus management system
 */

import { describe, expect, it, beforeEach } from "bun:test";
import { createInput, focus, KEYS } from "../src/index.ts";

describe("Focus Manager", () => {
  beforeEach(() => {
    // Clear all inputs between tests
    focus.clear();
  });

  it("registers inputs automatically", () => {
    expect(focus.getAll()).toHaveLength(0);

    const input1 = createInput();
    expect(focus.getAll()).toHaveLength(1);

    const input2 = createInput();
    expect(focus.getAll()).toHaveLength(2);

    input1.dispose();
    expect(focus.getAll()).toHaveLength(1);

    input2.dispose();
    expect(focus.getAll()).toHaveLength(0);
  });

  it("tracks focused input", () => {
    const input1 = createInput();
    const input2 = createInput();

    expect(focus.current()).toBe(null);

    input1.focus();
    expect(focus.current()).toBe(input1);
    expect(input1.focused()).toBe(true);
    expect(input2.focused()).toBe(false);

    input2.focus();
    expect(focus.current()).toBe(input2);
    expect(input1.focused()).toBe(false);
    expect(input2.focused()).toBe(true);

    input2.blur();
    expect(focus.current()).toBe(null);
    expect(input2.focused()).toBe(false);
  });

  it("navigates with next()", () => {
    const input1 = createInput();
    const input2 = createInput();
    const input3 = createInput();

    focus.next(); // Focus first when none focused
    expect(focus.current()).toBe(input1);

    focus.next();
    expect(focus.current()).toBe(input2);

    focus.next();
    expect(focus.current()).toBe(input3);

    focus.next(); // Wraps around
    expect(focus.current()).toBe(input1);
  });

  it("navigates with prev()", () => {
    const input1 = createInput();
    const input2 = createInput();
    const input3 = createInput();

    focus.prev(); // Focus last when none focused
    expect(focus.current()).toBe(input3);

    focus.prev();
    expect(focus.current()).toBe(input2);

    focus.prev();
    expect(focus.current()).toBe(input1);

    focus.prev(); // Wraps around
    expect(focus.current()).toBe(input3);
  });

  it("handles Tab key for focus navigation", () => {
    const input1 = createInput();
    const input2 = createInput();

    input1.focus();
    expect(focus.current()).toBe(input1);

    const consumed = focus.handleKey(KEYS.TAB);
    expect(consumed).toBe(true);
    expect(focus.current()).toBe(input2);
  });

  it("routes keys to focused input", () => {
    const input = createInput();
    input.focus();

    expect(input.value()).toBe("");

    focus.handleKey("a");
    expect(input.value()).toBe("a");

    focus.handleKey("b");
    expect(input.value()).toBe("ab");
  });

  it("returns false when no input focused", () => {
    createInput(); // registered but not focused

    const consumed = focus.handleKey("a");
    expect(consumed).toBe(false);
  });

  it("unregisters disposed inputs", () => {
    const input1 = createInput();
    const input2 = createInput();

    input1.focus();
    expect(focus.current()).toBe(input1);

    input1.dispose();
    expect(focus.current()).toBe(null);
    expect(focus.getAll()).toHaveLength(1);
    expect(focus.getAll()[0]).toBe(input2);
  });

  it("set() can focus or blur", () => {
    const input = createInput();

    focus.set(input);
    expect(focus.current()).toBe(input);

    focus.set(null);
    expect(focus.current()).toBe(null);
  });
});

// ============================================================================
// createKeySequence
// ============================================================================

import { createKeySequence } from "../src/core/focus.ts";

describe("createKeySequence", () => {
  it("handles single-key sequences", () => {
    let called = "";
    const handler = createKeySequence({
      sequences: {
        "g": () => { called = "g"; },
      },
    });

    expect(handler("g")).toBe(true);
    expect(called).toBe("g");
  });

  it("handles two-key sequences", () => {
    let called = "";
    const handler = createKeySequence({
      sequences: {
        "gg": () => { called = "gg"; },
        "dd": () => { called = "dd"; },
      },
    });

    // First 'g' is buffered
    expect(handler("g")).toBe(true);
    expect(called).toBe("");

    // Second 'g' triggers the sequence
    expect(handler("g")).toBe(true);
    expect(called).toBe("gg");
  });

  it("handles different sequences", () => {
    let called = "";
    const handler = createKeySequence({
      sequences: {
        "gg": () => { called = "gg"; },
        "dd": () => { called = "dd"; },
        "yy": () => { called = "yy"; },
      },
    });

    handler("d");
    handler("d");
    expect(called).toBe("dd");

    called = "";
    handler("y");
    handler("y");
    expect(called).toBe("yy");
  });

  it("resets buffer on invalid sequence", () => {
    let called = "";
    const handler = createKeySequence({
      sequences: {
        "gg": () => { called = "gg"; },
      },
      onUnmatched: (key) => {
        called = `unmatched:${key}`;
        return true;
      },
    });

    // 'g' is buffered
    handler("g");
    expect(called).toBe("");

    // 'x' is not a valid continuation, so buffer resets and onUnmatched is called
    handler("x");
    expect(called).toBe("unmatched:x");

    // Now 'gg' should work again
    called = "";
    handler("g");
    handler("g");
    expect(called).toBe("gg");
  });

  it("calls onUnmatched for non-prefix keys", () => {
    let called = "";
    const handler = createKeySequence({
      sequences: {
        "gg": () => { called = "gg"; },
      },
      onUnmatched: (key) => {
        called = `single:${key}`;
        return true;
      },
    });

    // 'j' is not a prefix for any sequence
    handler("j");
    expect(called).toBe("single:j");
  });

  it("returns false if no handler matches", () => {
    const handler = createKeySequence({
      sequences: {
        "gg": () => {},
      },
    });

    // 'x' is not a sequence or prefix, and no onUnmatched
    expect(handler("x")).toBe(false);
  });

  it("handles mixed length sequences", () => {
    let called = "";
    const handler = createKeySequence({
      sequences: {
        "d": () => { called = "d"; },
        "dd": () => { called = "dd"; },
        "daw": () => { called = "daw"; },
      },
    });

    // 'd' alone should trigger 'd' sequence since it's a complete sequence
    handler("d");
    expect(called).toBe("d");

    // But 'dd' should also work
    called = "";
    handler("d");
    expect(called).toBe("d"); // 'd' triggers immediately
  });

  it("prefers longer sequences when buffering", () => {
    let called = "";
    const handler = createKeySequence({
      sequences: {
        "gg": () => { called = "gg"; },
        "gx": () => { called = "gx"; },
      },
    });

    // 'g' should buffer because it's a prefix for multiple sequences
    expect(handler("g")).toBe(true);
    expect(called).toBe("");

    // 'g' again completes 'gg'
    expect(handler("g")).toBe(true);
    expect(called).toBe("gg");
  });
});

