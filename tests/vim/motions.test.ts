/**
 * Tests for vim motions.
 */

import { describe, it, expect } from "bun:test";
import { executeMotion, parseMotion } from "../../examples/vim/motions.ts";

describe("parseMotion", () => {
  it("parses basic motions", () => {
    expect(parseMotion("h")).toEqual({ type: "h", count: 1 });
    expect(parseMotion("j")).toEqual({ type: "j", count: 1 });
    expect(parseMotion("k")).toEqual({ type: "k", count: 1 });
    expect(parseMotion("l")).toEqual({ type: "l", count: 1 });
    expect(parseMotion("0")).toEqual({ type: "0", count: 1 });
    expect(parseMotion("$")).toEqual({ type: "$", count: 1 });
  });

  it("parses word motions", () => {
    expect(parseMotion("w")).toEqual({ type: "w", count: 1 });
    expect(parseMotion("b")).toEqual({ type: "b", count: 1 });
    expect(parseMotion("e")).toEqual({ type: "e", count: 1 });
  });

  it("parses file navigation", () => {
    expect(parseMotion("G")).toEqual({ type: "G", count: 1 });
  });

  it("returns null for non-motions", () => {
    expect(parseMotion("x")).toBeNull();
    expect(parseMotion("d")).toBeNull();
    expect(parseMotion("i")).toBeNull();
  });
});

describe("executeMotion - h (left)", () => {
  it("moves left within line", () => {
    const result = executeMotion(["hello"], { line: 0, col: 3 }, { type: "h", count: 1 });
    expect(result).toEqual({ line: 0, col: 2 });
  });

  it("stops at start of line", () => {
    const result = executeMotion(["hello"], { line: 0, col: 0 }, { type: "h", count: 1 });
    expect(result).toEqual({ line: 0, col: 0 });
  });

  it("moves multiple times with count", () => {
    const result = executeMotion(["hello"], { line: 0, col: 4 }, { type: "h", count: 3 });
    expect(result).toEqual({ line: 0, col: 1 });
  });
});

describe("executeMotion - l (right)", () => {
  it("moves right within line", () => {
    const result = executeMotion(["hello"], { line: 0, col: 1 }, { type: "l", count: 1 });
    expect(result).toEqual({ line: 0, col: 2 });
  });

  it("stops at end of line (normal mode - last char)", () => {
    const result = executeMotion(["hello"], { line: 0, col: 4 }, { type: "l", count: 1 });
    expect(result).toEqual({ line: 0, col: 4 }); // 'o' is at index 4
  });

  it("handles empty line", () => {
    const result = executeMotion([""], { line: 0, col: 0 }, { type: "l", count: 1 });
    expect(result).toEqual({ line: 0, col: 0 });
  });
});

describe("executeMotion - j (down)", () => {
  it("moves down one line", () => {
    const result = executeMotion(["hello", "world"], { line: 0, col: 2 }, { type: "j", count: 1 });
    expect(result).toEqual({ line: 1, col: 2 });
  });

  it("stops at last line", () => {
    const result = executeMotion(["hello", "world"], { line: 1, col: 0 }, { type: "j", count: 1 });
    expect(result).toEqual({ line: 1, col: 0 });
  });

  it("clamps column to shorter line", () => {
    const result = executeMotion(["hello", "hi"], { line: 0, col: 4 }, { type: "j", count: 1 });
    expect(result).toEqual({ line: 1, col: 1 }); // "hi" only has 2 chars (0-1)
  });

  it("moves multiple lines with count", () => {
    const result = executeMotion(["a", "b", "c", "d"], { line: 0, col: 0 }, { type: "j", count: 2 });
    expect(result).toEqual({ line: 2, col: 0 });
  });
});

describe("executeMotion - k (up)", () => {
  it("moves up one line", () => {
    const result = executeMotion(["hello", "world"], { line: 1, col: 2 }, { type: "k", count: 1 });
    expect(result).toEqual({ line: 0, col: 2 });
  });

  it("stops at first line", () => {
    const result = executeMotion(["hello", "world"], { line: 0, col: 0 }, { type: "k", count: 1 });
    expect(result).toEqual({ line: 0, col: 0 });
  });

  it("clamps column to shorter line", () => {
    const result = executeMotion(["hi", "hello"], { line: 1, col: 4 }, { type: "k", count: 1 });
    expect(result).toEqual({ line: 0, col: 1 }); // "hi" only has 2 chars
  });
});

describe("executeMotion - 0 (line start)", () => {
  it("moves to start of line", () => {
    const result = executeMotion(["hello"], { line: 0, col: 3 }, { type: "0", count: 1 });
    expect(result).toEqual({ line: 0, col: 0 });
  });

  it("stays at start if already there", () => {
    const result = executeMotion(["hello"], { line: 0, col: 0 }, { type: "0", count: 1 });
    expect(result).toEqual({ line: 0, col: 0 });
  });
});

describe("executeMotion - $ (line end)", () => {
  it("moves to end of line", () => {
    const result = executeMotion(["hello"], { line: 0, col: 0 }, { type: "$", count: 1 });
    expect(result).toEqual({ line: 0, col: 4 }); // last char 'o'
  });

  it("handles empty line", () => {
    const result = executeMotion([""], { line: 0, col: 0 }, { type: "$", count: 1 });
    expect(result).toEqual({ line: 0, col: 0 });
  });
});

describe("executeMotion - ^ (first non-whitespace)", () => {
  it("moves to first non-whitespace", () => {
    const result = executeMotion(["  hello"], { line: 0, col: 5 }, { type: "^", count: 1 });
    expect(result).toEqual({ line: 0, col: 2 });
  });

  it("handles line with no leading whitespace", () => {
    const result = executeMotion(["hello"], { line: 0, col: 3 }, { type: "^", count: 1 });
    expect(result).toEqual({ line: 0, col: 0 });
  });

  it("handles line with only whitespace", () => {
    const result = executeMotion(["   "], { line: 0, col: 0 }, { type: "^", count: 1 });
    expect(result).toEqual({ line: 0, col: 2 }); // clamps to last char
  });
});

describe("executeMotion - w (word forward)", () => {
  it("moves to next word", () => {
    const result = executeMotion(["hello world"], { line: 0, col: 0 }, { type: "w", count: 1 });
    expect(result).toEqual({ line: 0, col: 6 });
  });

  it("moves past punctuation", () => {
    const result = executeMotion(["hello, world"], { line: 0, col: 0 }, { type: "w", count: 1 });
    expect(result).toEqual({ line: 0, col: 5 }); // stops at comma
  });

  it("moves from middle of word to next word", () => {
    const result = executeMotion(["hello world"], { line: 0, col: 2 }, { type: "w", count: 1 });
    expect(result).toEqual({ line: 0, col: 6 });
  });

  it("moves to next line if at end", () => {
    const result = executeMotion(["hello", "world"], { line: 0, col: 4 }, { type: "w", count: 1 });
    expect(result).toEqual({ line: 1, col: 0 });
  });

  it("moves multiple words with count", () => {
    const result = executeMotion(["one two three"], { line: 0, col: 0 }, { type: "w", count: 2 });
    expect(result).toEqual({ line: 0, col: 8 });
  });
});

describe("executeMotion - b (word backward)", () => {
  it("moves to previous word start", () => {
    const result = executeMotion(["hello world"], { line: 0, col: 8 }, { type: "b", count: 1 });
    expect(result).toEqual({ line: 0, col: 6 });
  });

  it("moves from middle of word to its start", () => {
    const result = executeMotion(["hello world"], { line: 0, col: 2 }, { type: "b", count: 1 });
    expect(result).toEqual({ line: 0, col: 0 });
  });

  it("moves to previous line if at start", () => {
    const result = executeMotion(["hello", "world"], { line: 1, col: 0 }, { type: "b", count: 1 });
    expect(result).toEqual({ line: 0, col: 4 });
  });
});

describe("executeMotion - e (word end)", () => {
  it("moves to end of current word", () => {
    const result = executeMotion(["hello world"], { line: 0, col: 0 }, { type: "e", count: 1 });
    expect(result).toEqual({ line: 0, col: 4 });
  });

  it("moves to end of next word if at word end", () => {
    const result = executeMotion(["hello world"], { line: 0, col: 4 }, { type: "e", count: 1 });
    expect(result).toEqual({ line: 0, col: 10 });
  });

  it("moves multiple word ends with count", () => {
    const result = executeMotion(["one two three"], { line: 0, col: 0 }, { type: "e", count: 2 });
    expect(result).toEqual({ line: 0, col: 6 });
  });
});

describe("executeMotion - gg (file start)", () => {
  it("moves to first line", () => {
    const result = executeMotion(["a", "b", "c"], { line: 2, col: 0 }, { type: "gg", count: 1 });
    expect(result).toEqual({ line: 0, col: 0 });
  });

  it("stays at first line if already there", () => {
    const result = executeMotion(["a", "b", "c"], { line: 0, col: 0 }, { type: "gg", count: 1 });
    expect(result).toEqual({ line: 0, col: 0 });
  });
});

describe("executeMotion - G (file end)", () => {
  it("moves to last line", () => {
    const result = executeMotion(["a", "b", "c"], { line: 0, col: 0 }, { type: "G", count: 1 });
    expect(result).toEqual({ line: 2, col: 0 });
  });

  it("stays at last line if already there", () => {
    const result = executeMotion(["a", "b", "c"], { line: 2, col: 0 }, { type: "G", count: 1 });
    expect(result).toEqual({ line: 2, col: 0 });
  });
});
