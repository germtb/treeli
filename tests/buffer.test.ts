import { describe, expect, it } from "bun:test";
import { CellBuffer } from "../src/core/buffer.ts";
import { createCell, EMPTY_CELL } from "../src/core/cell.ts";

describe("CellBuffer", () => {
  it("creates a buffer with correct dimensions", () => {
    const buffer = new CellBuffer(80, 24);
    expect(buffer.width).toBe(80);
    expect(buffer.height).toBe(24);
  });

  it("initializes all cells to empty", () => {
    const buffer = new CellBuffer(10, 5);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 10; x++) {
        expect(buffer.get(x, y)).toEqual(EMPTY_CELL);
      }
    }
  });

  it("sets and gets cells correctly", () => {
    const buffer = new CellBuffer(10, 5);
    const cell = createCell("X", { color: "red" });
    buffer.set(3, 2, cell);
    expect(buffer.get(3, 2)).toEqual(cell);
  });

  it("ignores out-of-bounds writes", () => {
    const buffer = new CellBuffer(10, 5);
    buffer.set(-1, 0, createCell("X"));
    buffer.set(100, 0, createCell("X"));
    buffer.set(0, -1, createCell("X"));
    buffer.set(0, 100, createCell("X"));
    // No error thrown, and reading returns EMPTY_CELL
    expect(buffer.get(-1, 0)).toEqual(EMPTY_CELL);
    expect(buffer.get(100, 0)).toEqual(EMPTY_CELL);
  });

  it("writes strings correctly", () => {
    const buffer = new CellBuffer(10, 5);
    buffer.writeString(2, 1, "Hello", { color: "green" });

    expect(buffer.get(2, 1).char).toBe("H");
    expect(buffer.get(3, 1).char).toBe("e");
    expect(buffer.get(4, 1).char).toBe("l");
    expect(buffer.get(5, 1).char).toBe("l");
    expect(buffer.get(6, 1).char).toBe("o");
    expect(buffer.get(2, 1).style.color).toBe("green");
  });

  it("clips string at buffer edge", () => {
    const buffer = new CellBuffer(5, 1);
    const written = buffer.writeString(3, 0, "Hello");
    expect(written).toBe(2); // Only 2 chars fit in buffer (positions 3 and 4)
    expect(buffer.get(3, 0).char).toBe("H");
    expect(buffer.get(4, 0).char).toBe("e");
    // Text beyond buffer edge is clipped
  });

  it("fills rectangles", () => {
    const buffer = new CellBuffer(10, 5);
    const cell = createCell("#", { background: "blue" });
    buffer.fillRect(2, 1, 3, 2, cell);

    expect(buffer.get(2, 1)).toEqual(cell);
    expect(buffer.get(4, 2)).toEqual(cell);
    expect(buffer.get(1, 1)).toEqual(EMPTY_CELL);
    expect(buffer.get(5, 1)).toEqual(EMPTY_CELL);
  });

  it("clears the buffer", () => {
    const buffer = new CellBuffer(10, 5);
    buffer.writeString(0, 0, "Hello");
    buffer.clear();
    expect(buffer.get(0, 0)).toEqual(EMPTY_CELL);
  });

  it("clones correctly", () => {
    const buffer = new CellBuffer(10, 5);
    buffer.writeString(0, 0, "Test");
    const clone = buffer.clone();

    expect(clone.equals(buffer)).toBe(true);

    // Modifying clone doesn't affect original
    clone.writeString(0, 0, "XXXX");
    expect(buffer.get(0, 0).char).toBe("T");
    expect(clone.get(0, 0).char).toBe("X");
  });

  it("blits one buffer onto another", () => {
    const target = new CellBuffer(10, 5);
    const source = new CellBuffer(3, 2);
    source.writeString(0, 0, "ABC");
    source.writeString(0, 1, "DEF");

    target.blit(source, 2, 1);

    expect(target.get(2, 1).char).toBe("A");
    expect(target.get(3, 1).char).toBe("B");
    expect(target.get(4, 1).char).toBe("C");
    expect(target.get(2, 2).char).toBe("D");
  });

  it("produces correct debug string", () => {
    const buffer = new CellBuffer(5, 2);
    buffer.writeString(0, 0, "Hello");
    buffer.writeString(0, 1, "World");

    // Note: "Hello" is 5 chars but buffer is 5 wide, so it fits
    // "World" is 5 chars
    expect(buffer.toDebugString()).toBe("Hello\nWorld");
  });
});
