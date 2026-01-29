import { describe, expect, it } from "bun:test";
import { normalizeSpacing, getBorderStyle, BORDER_CHARS } from "../src/core/props.ts";

describe("normalizeSpacing", () => {
  it("returns zeros for undefined", () => {
    expect(normalizeSpacing(undefined)).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it("expands number to all sides", () => {
    expect(normalizeSpacing(2)).toEqual({
      top: 2,
      right: 2,
      bottom: 2,
      left: 2,
    });
  });

  it("preserves partial object, fills missing with 0", () => {
    expect(normalizeSpacing({ top: 1, left: 3 })).toEqual({
      top: 1,
      right: 0,
      bottom: 0,
      left: 3,
    });
  });

  it("handles full object", () => {
    const full = { top: 1, right: 2, bottom: 3, left: 4 };
    expect(normalizeSpacing(full)).toEqual(full);
  });
});

describe("getBorderStyle", () => {
  it("returns 'none' for undefined/false", () => {
    expect(getBorderStyle(undefined)).toBe("none");
    expect(getBorderStyle(false)).toBe("none");
    expect(getBorderStyle("none")).toBe("none");
  });

  it("returns 'single' for true", () => {
    expect(getBorderStyle(true)).toBe("single");
  });

  it("passes through explicit styles", () => {
    expect(getBorderStyle("double")).toBe("double");
    expect(getBorderStyle("rounded")).toBe("rounded");
    expect(getBorderStyle("bold")).toBe("bold");
  });
});

describe("BORDER_CHARS", () => {
  it("has all required characters for each style", () => {
    for (const style of ["single", "double", "rounded", "bold"] as const) {
      const chars = BORDER_CHARS[style];
      expect(chars.topLeft).toBeDefined();
      expect(chars.topRight).toBeDefined();
      expect(chars.bottomLeft).toBeDefined();
      expect(chars.bottomRight).toBeDefined();
      expect(chars.horizontal).toBeDefined();
      expect(chars.vertical).toBeDefined();
    }
  });
});
