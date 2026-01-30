/**
 * Tests for vim mode switching.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createVim, type Vim, KEYS } from "../../examples/vim/vim.ts";
import { focus } from "../../src/core/focus.ts";

describe("createVim - initialization", () => {
  let vim: Vim;

  afterEach(() => {
    vim?.dispose();
    focus.clear();
  });

  it("creates with empty default value", () => {
    vim = createVim();
    expect(vim.lines()).toEqual([""]);
    expect(vim.cursor()).toEqual({ line: 0, col: 0 });
    expect(vim.mode()).toBe("normal");
  });

  it("creates with string initial value", () => {
    vim = createVim({ initialValue: "hello\nworld" });
    expect(vim.lines()).toEqual(["hello", "world"]);
    expect(vim.value()).toBe("hello\nworld");
  });

  it("creates with array initial value", () => {
    vim = createVim({ initialValue: ["line1", "line2"] });
    expect(vim.lines()).toEqual(["line1", "line2"]);
  });

  it("starts in normal mode", () => {
    vim = createVim({ initialValue: "test" });
    expect(vim.mode()).toBe("normal");
  });
});

describe("createVim - insert mode entry", () => {
  let vim: Vim;

  beforeEach(() => {
    vim = createVim({ initialValue: "hello" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("i enters insert mode at cursor", () => {
    vim.setCursor({ line: 0, col: 2 });
    vim.handleKey("i");
    expect(vim.mode()).toBe("insert");
    expect(vim.cursor()).toEqual({ line: 0, col: 2 });
  });

  it("a enters insert mode after cursor", () => {
    vim.setCursor({ line: 0, col: 2 });
    vim.handleKey("a");
    expect(vim.mode()).toBe("insert");
    expect(vim.cursor()).toEqual({ line: 0, col: 3 });
  });

  it("A enters insert mode at end of line", () => {
    vim.setCursor({ line: 0, col: 0 });
    vim.handleKey("A");
    expect(vim.mode()).toBe("insert");
    expect(vim.cursor()).toEqual({ line: 0, col: 5 });
  });

  it("I enters insert mode at first non-whitespace", () => {
    vim.setValue("  hello");
    vim.setCursor({ line: 0, col: 5 });
    vim.handleKey("I");
    expect(vim.mode()).toBe("insert");
    expect(vim.cursor()).toEqual({ line: 0, col: 2 });
  });

  it("o opens new line below and enters insert", () => {
    vim.setCursor({ line: 0, col: 0 });
    vim.handleKey("o");
    expect(vim.mode()).toBe("insert");
    expect(vim.lines()).toEqual(["hello", ""]);
    expect(vim.cursor()).toEqual({ line: 1, col: 0 });
  });

  it("O opens new line above and enters insert", () => {
    vim.setCursor({ line: 0, col: 0 });
    vim.handleKey("O");
    expect(vim.mode()).toBe("insert");
    expect(vim.lines()).toEqual(["", "hello"]);
    expect(vim.cursor()).toEqual({ line: 0, col: 0 });
  });
});

describe("createVim - insert mode editing", () => {
  let vim: Vim;

  beforeEach(() => {
    vim = createVim({ initialValue: "hello" });
    vim.focus();
    vim.handleKey("i");
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("types characters", () => {
    vim.handleKey("X");
    expect(vim.value()).toBe("Xhello");
    expect(vim.cursor()).toEqual({ line: 0, col: 1 });
  });

  it("backspace deletes character", () => {
    vim.setCursor({ line: 0, col: 3 });
    vim.setMode("insert");
    vim.handleKey(KEYS.BACKSPACE);
    expect(vim.value()).toBe("helo");
  });

  it("Escape exits insert mode", () => {
    vim.handleKey(KEYS.ESCAPE);
    expect(vim.mode()).toBe("normal");
  });

  it("Escape moves cursor back one", () => {
    vim.setCursor({ line: 0, col: 3 });
    vim.setMode("insert");
    vim.handleKey(KEYS.ESCAPE);
    expect(vim.cursor()).toEqual({ line: 0, col: 2 });
  });

  it("Enter creates new line", () => {
    vim.setCursor({ line: 0, col: 3 });
    vim.setMode("insert");
    vim.handleKey(KEYS.ENTER);
    expect(vim.lines()).toEqual(["hel", "lo"]);
    expect(vim.cursor()).toEqual({ line: 1, col: 0 });
  });

  it("Enter at start of line", () => {
    vim.setCursor({ line: 0, col: 0 });
    vim.setMode("insert");
    vim.handleKey(KEYS.ENTER);
    expect(vim.lines()).toEqual(["", "hello"]);
    expect(vim.cursor()).toEqual({ line: 1, col: 0 });
  });

  it("Enter at end of line", () => {
    vim.setCursor({ line: 0, col: 5 });
    vim.setMode("insert");
    vim.handleKey(KEYS.ENTER);
    expect(vim.lines()).toEqual(["hello", ""]);
    expect(vim.cursor()).toEqual({ line: 1, col: 0 });
  });
});

describe("createVim - visual mode", () => {
  let vim: Vim;

  beforeEach(() => {
    vim = createVim({ initialValue: "hello world" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("v enters visual mode", () => {
    vim.handleKey("v");
    expect(vim.mode()).toBe("visual");
    expect(vim.visualStart()).toEqual({ line: 0, col: 0 });
  });

  it("v in visual mode exits to normal", () => {
    vim.handleKey("v");
    vim.handleKey("v");
    expect(vim.mode()).toBe("normal");
    expect(vim.visualStart()).toBeNull();
  });

  it("Escape exits visual mode", () => {
    vim.handleKey("v");
    vim.handleKey(KEYS.ESCAPE);
    expect(vim.mode()).toBe("normal");
  });

  it("motions extend selection in visual mode", () => {
    vim.handleKey("v");
    vim.handleKey("l");
    vim.handleKey("l");
    expect(vim.cursor()).toEqual({ line: 0, col: 2 });
    expect(vim.visualStart()).toEqual({ line: 0, col: 0 });
    expect(vim.visualSelection()).toEqual({
      start: { line: 0, col: 0 },
      end: { line: 0, col: 2 },
    });
  });
});

describe("createVim - normal mode navigation", () => {
  let vim: Vim;

  beforeEach(() => {
    vim = createVim({ initialValue: "hello\nworld" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("h moves left", () => {
    vim.setCursor({ line: 0, col: 2 });
    vim.handleKey("h");
    expect(vim.cursor()).toEqual({ line: 0, col: 1 });
  });

  it("l moves right", () => {
    vim.setCursor({ line: 0, col: 2 });
    vim.handleKey("l");
    expect(vim.cursor()).toEqual({ line: 0, col: 3 });
  });

  it("j moves down", () => {
    vim.handleKey("j");
    expect(vim.cursor()).toEqual({ line: 1, col: 0 });
  });

  it("k moves up", () => {
    vim.setCursor({ line: 1, col: 0 });
    vim.handleKey("k");
    expect(vim.cursor()).toEqual({ line: 0, col: 0 });
  });

  it("0 moves to line start", () => {
    vim.setCursor({ line: 0, col: 3 });
    vim.handleKey("0");
    expect(vim.cursor()).toEqual({ line: 0, col: 0 });
  });

  it("$ moves to line end", () => {
    vim.handleKey("$");
    expect(vim.cursor()).toEqual({ line: 0, col: 4 });
  });

  it("gg moves to file start", () => {
    vim.setCursor({ line: 1, col: 0 });
    vim.handleKey("g");
    vim.handleKey("g");
    expect(vim.cursor()).toEqual({ line: 0, col: 0 });
  });

  it("G moves to last line", () => {
    vim.handleKey("G");
    expect(vim.cursor()).toEqual({ line: 1, col: 0 });
  });
});

describe("createVim - count prefix", () => {
  let vim: Vim;

  beforeEach(() => {
    vim = createVim({ initialValue: "hello\nworld\ntest\nfoo" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("3j moves down 3 lines", () => {
    vim.handleKey("3");
    vim.handleKey("j");
    expect(vim.cursor()).toEqual({ line: 3, col: 0 });
  });

  it("2l moves right 2 characters", () => {
    vim.handleKey("2");
    vim.handleKey("l");
    expect(vim.cursor()).toEqual({ line: 0, col: 2 });
  });

  it("10 builds multi-digit count", () => {
    vim.handleKey("1");
    vim.handleKey("0");
    vim.handleKey("l"); // Would move 10 right but clamped to line end
    // "hello" has 5 chars (0-4)
    expect(vim.cursor()).toEqual({ line: 0, col: 4 });
  });

  it("0 at start of count is line start motion", () => {
    vim.setCursor({ line: 0, col: 3 });
    vim.handleKey("0");
    expect(vim.cursor()).toEqual({ line: 0, col: 0 });
  });
});

describe("createVim - callbacks", () => {
  let vim: Vim;
  let changeCount = 0;
  let modeChanges: string[] = [];

  beforeEach(() => {
    changeCount = 0;
    modeChanges = [];
    vim = createVim({
      initialValue: "hello",
      onChange: () => changeCount++,
      onModeChange: (mode) => modeChanges.push(mode),
    });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("calls onModeChange when mode changes", () => {
    vim.handleKey("i");
    expect(modeChanges).toEqual(["insert"]);
    vim.handleKey(KEYS.ESCAPE);
    expect(modeChanges).toEqual(["insert", "normal"]);
  });

  it("calls onChange when content changes in insert mode", () => {
    vim.handleKey("i");
    vim.handleKey("X");
    expect(changeCount).toBeGreaterThan(0);
  });
});
