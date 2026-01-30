/**
 * Integration tests for vim editor.
 * Tests complete workflows with the vim primitive.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createVim, type Vim, KEYS } from "../../examples/vim/vim.ts";
import { focus } from "../../src/core/focus.ts";

describe("vim integration - basic workflow", () => {
  let vim: Vim;

  beforeEach(() => {
    focus.clear();
    vim = createVim({ initialValue: "hello world" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("starts in normal mode with correct initial state", () => {
    expect(vim.mode()).toBe("normal");
    expect(vim.value()).toBe("hello world");
    expect(vim.cursor()).toEqual({ line: 0, col: 0 });
  });

  it("navigates with hjkl", () => {
    expect(vim.cursor()).toEqual({ line: 0, col: 0 });

    vim.handleKey("l");
    expect(vim.cursor()).toEqual({ line: 0, col: 1 });

    vim.handleKey("l");
    vim.handleKey("l");
    expect(vim.cursor()).toEqual({ line: 0, col: 3 });

    vim.handleKey("h");
    expect(vim.cursor()).toEqual({ line: 0, col: 2 });
  });

  it("enters insert mode and types", () => {
    vim.handleKey("i");
    expect(vim.mode()).toBe("insert");

    vim.handleKey("X");
    expect(vim.value()).toBe("Xhello world");
  });

  it("exits insert mode with Escape", () => {
    vim.handleKey("i");
    vim.handleKey("X");
    vim.handleKey("Y");
    vim.handleKey(KEYS.ESCAPE);

    expect(vim.mode()).toBe("normal");
    expect(vim.value()).toBe("XYhello world");
  });

  it("deletes with x", () => {
    vim.handleKey("x");
    expect(vim.value()).toBe("ello world");
  });

  it("word navigation with w", () => {
    vim.handleKey("w");
    expect(vim.cursor()).toEqual({ line: 0, col: 6 }); // start of "world"
  });
});

describe("vim integration - multiline editing", () => {
  let vim: Vim;

  beforeEach(() => {
    focus.clear();
    vim = createVim({ initialValue: "line one\nline two\nline three" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("has correct initial lines", () => {
    expect(vim.lines()).toEqual(["line one", "line two", "line three"]);
  });

  it("navigates between lines with jk", () => {
    vim.handleKey("j");
    expect(vim.cursor().line).toBe(1);

    vim.handleKey("j");
    expect(vim.cursor().line).toBe(2);

    vim.handleKey("k");
    expect(vim.cursor().line).toBe(1);
  });

  it("deletes line with dd", () => {
    vim.handleKey("d");
    vim.handleKey("d");
    expect(vim.lines()).toEqual(["line two", "line three"]);
  });

  it("yanks and pastes line with yy and p", () => {
    vim.handleKey("y");
    vim.handleKey("y");
    vim.handleKey("p");
    expect(vim.lines()).toEqual(["line one", "line one", "line two", "line three"]);
  });

  it("opens new line below with o", () => {
    vim.handleKey("o");
    expect(vim.mode()).toBe("insert");
    expect(vim.cursor()).toEqual({ line: 1, col: 0 });

    vim.handleKey("n");
    vim.handleKey("e");
    vim.handleKey("w");
    vim.handleKey(KEYS.ESCAPE);

    expect(vim.lines()).toEqual(["line one", "new", "line two", "line three"]);
  });

  it("opens new line above with O", () => {
    vim.handleKey("j"); // go to line 2
    vim.handleKey("O");
    expect(vim.mode()).toBe("insert");

    vim.handleKey("a");
    vim.handleKey("b");
    vim.handleKey("c");
    vim.handleKey(KEYS.ESCAPE);

    expect(vim.lines()).toEqual(["line one", "abc", "line two", "line three"]);
  });
});

describe("vim integration - visual mode", () => {
  let vim: Vim;

  beforeEach(() => {
    focus.clear();
    vim = createVim({ initialValue: "hello world" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("enters visual mode with v", () => {
    vim.handleKey("v");
    expect(vim.mode()).toBe("visual");
    expect(vim.visualStart()).toEqual({ line: 0, col: 0 });
  });

  it("extends selection with motion", () => {
    vim.handleKey("v");
    vim.handleKey("l");
    vim.handleKey("l");
    vim.handleKey("l");
    vim.handleKey("l"); // select "hello"

    const sel = vim.visualSelection();
    expect(sel).not.toBeNull();
    expect(sel!.start).toEqual({ line: 0, col: 0 });
    expect(sel!.end).toEqual({ line: 0, col: 4 });
  });

  it("deletes selection with d", () => {
    vim.handleKey("v");
    vim.handleKey("l");
    vim.handleKey("l");
    vim.handleKey("l");
    vim.handleKey("l"); // select "hello"
    vim.handleKey("d");

    expect(vim.value()).toBe(" world");
    expect(vim.mode()).toBe("normal");
  });

  it("yanks selection with y", () => {
    vim.handleKey("v");
    vim.handleKey("e"); // select to end of word
    vim.handleKey("y");

    expect(vim.register()).toBe("hello");
    expect(vim.value()).toBe("hello world"); // unchanged
    expect(vim.mode()).toBe("normal");
  });
});

describe("vim integration - operators with motions", () => {
  let vim: Vim;

  beforeEach(() => {
    focus.clear();
    vim = createVim({ initialValue: "one two three" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("dw deletes word", () => {
    vim.handleKey("d");
    vim.handleKey("w");
    expect(vim.value()).toBe("two three");
  });

  it("d$ deletes to end of line", () => {
    vim.handleKey("w"); // move to "two"
    vim.handleKey("d");
    vim.handleKey("$");
    expect(vim.value()).toBe("one ");
  });

  it("de deletes to end of word (inclusive)", () => {
    vim.handleKey("d");
    vim.handleKey("e");
    expect(vim.value()).toBe(" two three");
  });

  it("yw yanks word", () => {
    vim.handleKey("y");
    vim.handleKey("w");
    expect(vim.register()).toBe("one ");
    expect(vim.value()).toBe("one two three"); // unchanged
  });

  it("2dw deletes 2 words", () => {
    vim.handleKey("2");
    vim.handleKey("d");
    vim.handleKey("w");
    expect(vim.value()).toBe("three");
  });
});

describe("vim integration - count prefix", () => {
  let vim: Vim;

  beforeEach(() => {
    focus.clear();
    vim = createVim({ initialValue: "abcdefghij\n1234567890\nABCDEFGHIJ" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("3l moves right 3 characters", () => {
    vim.handleKey("3");
    vim.handleKey("l");
    expect(vim.cursor()).toEqual({ line: 0, col: 3 });
  });

  it("2j moves down 2 lines", () => {
    vim.handleKey("2");
    vim.handleKey("j");
    expect(vim.cursor()).toEqual({ line: 2, col: 0 });
  });

  it("3x deletes 3 characters", () => {
    vim.handleKey("3");
    vim.handleKey("x");
    expect(vim.lines()[0]).toBe("defghij");
  });
});

describe("vim integration - complete editing workflow", () => {
  let vim: Vim;

  beforeEach(() => {
    focus.clear();
    vim = createVim({ initialValue: "" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("creates and edits a document", () => {
    // Enter insert mode and type first line
    vim.handleKey("i");
    "Hello World".split("").forEach((c) => vim.handleKey(c));
    vim.handleKey(KEYS.ESCAPE);

    expect(vim.value()).toBe("Hello World");

    // Go to start and delete first word
    vim.handleKey("0"); // go to start
    vim.handleKey("d");
    vim.handleKey("w"); // delete "Hello "

    expect(vim.value()).toBe("World");

    // Add new text at the beginning
    vim.handleKey("i");
    "New ".split("").forEach((c) => vim.handleKey(c));
    vim.handleKey(KEYS.ESCAPE);

    expect(vim.value()).toBe("New World");
  });

  it("copy and paste workflow", () => {
    vim.setValue("line 1\nline 2\nline 3");

    // Yank line 1
    vim.handleKey("y");
    vim.handleKey("y");

    // Move to line 3
    vim.handleKey("G");

    // Paste
    vim.handleKey("p");

    expect(vim.lines()).toEqual(["line 1", "line 2", "line 3", "line 1"]);
  });

  it("delete multiple words workflow", () => {
    vim.setValue("The quick brown fox");

    // Move to "quick"
    vim.handleKey("w");

    // Delete "quick "
    vim.handleKey("d");
    vim.handleKey("w");

    expect(vim.value()).toBe("The brown fox");

    // Delete "brown "
    vim.handleKey("d");
    vim.handleKey("w");

    expect(vim.value()).toBe("The fox");
  });
});
