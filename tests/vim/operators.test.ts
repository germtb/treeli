/**
 * Tests for vim operators.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createVim, type Vim, KEYS } from "../../examples/vim/vim.ts";
import { focus } from "../../src/core/focus.ts";

describe("operators - x (delete char)", () => {
  let vim: Vim;

  beforeEach(() => {
    vim = createVim({ initialValue: "hello" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("x deletes character at cursor", () => {
    vim.handleKey("x");
    expect(vim.value()).toBe("ello");
  });

  it("x deletes character in middle", () => {
    vim.setCursor({ line: 0, col: 2 });
    vim.handleKey("x");
    expect(vim.value()).toBe("helo");
    expect(vim.cursor()).toEqual({ line: 0, col: 2 });
  });

  it("x at end of line clamps cursor", () => {
    vim.setCursor({ line: 0, col: 4 });
    vim.handleKey("x");
    expect(vim.value()).toBe("hell");
    expect(vim.cursor()).toEqual({ line: 0, col: 3 });
  });

  it("3x deletes 3 characters", () => {
    vim.handleKey("3");
    vim.handleKey("x");
    expect(vim.value()).toBe("lo");
  });

  it("x on empty line does nothing", () => {
    vim.setValue("");
    vim.handleKey("x");
    expect(vim.value()).toBe("");
  });
});

describe("operators - dd (delete line)", () => {
  let vim: Vim;

  beforeEach(() => {
    vim = createVim({ initialValue: "line1\nline2\nline3" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("dd deletes current line", () => {
    vim.handleKey("d");
    vim.handleKey("d");
    expect(vim.lines()).toEqual(["line2", "line3"]);
    expect(vim.cursor()).toEqual({ line: 0, col: 0 });
  });

  it("dd yanks deleted line to register", () => {
    vim.handleKey("d");
    vim.handleKey("d");
    expect(vim.register()).toBe("line1\n"); // trailing newline marks line-wise
  });

  it("dd on last line moves cursor up", () => {
    vim.setCursor({ line: 2, col: 0 });
    vim.handleKey("d");
    vim.handleKey("d");
    expect(vim.lines()).toEqual(["line1", "line2"]);
    expect(vim.cursor()).toEqual({ line: 1, col: 0 });
  });

  it("2dd deletes 2 lines", () => {
    vim.handleKey("2");
    vim.handleKey("d");
    vim.handleKey("d");
    expect(vim.lines()).toEqual(["line3"]);
  });

  it("dd on single line leaves empty line", () => {
    vim.setValue("only");
    vim.handleKey("d");
    vim.handleKey("d");
    expect(vim.lines()).toEqual([""]);
  });
});

describe("operators - yy (yank line)", () => {
  let vim: Vim;

  beforeEach(() => {
    vim = createVim({ initialValue: "line1\nline2\nline3" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("yy yanks current line", () => {
    vim.handleKey("y");
    vim.handleKey("y");
    expect(vim.register()).toBe("line1\n"); // trailing newline marks line-wise
    expect(vim.value()).toBe("line1\nline2\nline3"); // unchanged
  });

  it("2yy yanks 2 lines", () => {
    vim.handleKey("2");
    vim.handleKey("y");
    vim.handleKey("y");
    expect(vim.register()).toBe("line1\nline2\n"); // trailing newline marks line-wise
  });
});

describe("operators - p (paste after)", () => {
  let vim: Vim;

  beforeEach(() => {
    vim = createVim({ initialValue: "hello\nworld" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("p pastes character-wise after cursor", () => {
    vim.handleKey("x"); // delete 'h', puts in register
    vim.setCursor({ line: 0, col: 3 }); // at 'o'
    vim.handleKey("p");
    expect(vim.value()).toBe("elloh\nworld");
  });

  it("p pastes line-wise on new line below", () => {
    vim.handleKey("y");
    vim.handleKey("y"); // yank "hello"
    vim.handleKey("p");
    expect(vim.lines()).toEqual(["hello", "hello", "world"]);
    expect(vim.cursor()).toEqual({ line: 1, col: 0 });
  });

  it("2p pastes twice", () => {
    vim.handleKey("y");
    vim.handleKey("y");
    vim.handleKey("2");
    vim.handleKey("p");
    expect(vim.lines()).toEqual(["hello", "hello", "hello", "world"]);
  });
});

describe("operators - P (paste before)", () => {
  let vim: Vim;

  beforeEach(() => {
    vim = createVim({ initialValue: "hello\nworld" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("P pastes line-wise on new line above", () => {
    vim.setCursor({ line: 1, col: 0 });
    vim.handleKey("y");
    vim.handleKey("y"); // yank "world"
    vim.setCursor({ line: 0, col: 0 });
    vim.handleKey("P");
    expect(vim.lines()).toEqual(["world", "hello", "world"]);
    expect(vim.cursor()).toEqual({ line: 0, col: 0 });
  });
});

describe("operators - d{motion} (delete with motion)", () => {
  let vim: Vim;

  beforeEach(() => {
    vim = createVim({ initialValue: "hello world test" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("dw deletes to next word", () => {
    vim.handleKey("d");
    expect(vim.mode()).toBe("operator-pending");
    vim.handleKey("w");
    expect(vim.mode()).toBe("normal");
    expect(vim.value()).toBe("world test");
  });

  it("d$ deletes to end of line", () => {
    vim.setCursor({ line: 0, col: 6 }); // at 'w'
    vim.handleKey("d");
    vim.handleKey("$");
    expect(vim.value()).toBe("hello ");
  });

  it("d with escape cancels operator", () => {
    vim.handleKey("d");
    expect(vim.mode()).toBe("operator-pending");
    vim.handleKey(KEYS.ESCAPE);
    expect(vim.mode()).toBe("normal");
    expect(vim.value()).toBe("hello world test"); // unchanged
  });

  it("d yanks deleted text to register", () => {
    vim.handleKey("d");
    vim.handleKey("w");
    expect(vim.register()).toBe("hello ");
  });
});

describe("operators - y{motion} (yank with motion)", () => {
  let vim: Vim;

  beforeEach(() => {
    vim = createVim({ initialValue: "hello world" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("yw yanks to next word", () => {
    vim.handleKey("y");
    expect(vim.mode()).toBe("operator-pending");
    vim.handleKey("w");
    expect(vim.mode()).toBe("normal");
    expect(vim.register()).toBe("hello ");
    expect(vim.value()).toBe("hello world"); // unchanged
  });

  it("y$ yanks to end of line", () => {
    vim.setCursor({ line: 0, col: 6 }); // at 'w'
    vim.handleKey("y");
    vim.handleKey("$");
    expect(vim.register()).toBe("world");
  });
});

describe("visual mode operators", () => {
  let vim: Vim;

  beforeEach(() => {
    vim = createVim({ initialValue: "hello world" });
    vim.focus();
  });

  afterEach(() => {
    vim.dispose();
    focus.clear();
  });

  it("visual d deletes selection", () => {
    vim.handleKey("v"); // enter visual mode
    vim.handleKey("l");
    vim.handleKey("l"); // select "hel"
    vim.handleKey("d");
    expect(vim.value()).toBe("lo world");
    expect(vim.mode()).toBe("normal");
  });

  it("visual y yanks selection", () => {
    vim.handleKey("v");
    vim.handleKey("l");
    vim.handleKey("l");
    vim.handleKey("l");
    vim.handleKey("l"); // select "hello"
    vim.handleKey("y");
    expect(vim.register()).toBe("hello");
    expect(vim.value()).toBe("hello world"); // unchanged
    expect(vim.mode()).toBe("normal");
  });

  it("visual x deletes selection (same as d)", () => {
    vim.handleKey("v");
    vim.handleKey("w"); // select to next word
    vim.handleKey("x");
    expect(vim.value()).toBe("orld");
  });
});
