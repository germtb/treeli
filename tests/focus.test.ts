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
