import { describe, expect, it } from "bun:test";
import { CellBuffer } from "../src/core/buffer.ts";
import { diffBuffers, findRuns, groupChangesByRow } from "../src/core/diff.ts";
import { createCell } from "../src/core/cell.ts";

describe("diffBuffers", () => {
  it("returns empty array for identical buffers", () => {
    const a = new CellBuffer(10, 5);
    const b = new CellBuffer(10, 5);
    a.writeString(0, 0, "Hello");
    b.writeString(0, 0, "Hello");

    const changes = diffBuffers(a, b);
    expect(changes).toEqual([]);
  });

  it("detects single character change", () => {
    const a = new CellBuffer(10, 5);
    const b = new CellBuffer(10, 5);
    a.writeString(0, 0, "Hello");
    b.writeString(0, 0, "Hallo");

    const changes = diffBuffers(a, b);
    expect(changes.length).toBe(1);
    expect(changes[0]).toEqual({ x: 1, y: 0, cell: createCell("a") });
  });

  it("detects multiple changes", () => {
    const a = new CellBuffer(10, 5);
    const b = new CellBuffer(10, 5);
    a.writeString(0, 0, "AAAA");
    b.writeString(0, 0, "ABBA");

    const changes = diffBuffers(a, b);
    expect(changes.length).toBe(2);
    expect(changes[0]!.x).toBe(1);
    expect(changes[1]!.x).toBe(2);
  });

  it("detects style changes even with same character", () => {
    const a = new CellBuffer(10, 5);
    const b = new CellBuffer(10, 5);
    a.writeString(0, 0, "X", {});
    b.writeString(0, 0, "X", { color: "red" });

    const changes = diffBuffers(a, b);
    expect(changes.length).toBe(1);
    expect(changes[0]!.cell.style.color).toBe("red");
  });

  it("handles buffer size differences", () => {
    const small = new CellBuffer(5, 3);
    const large = new CellBuffer(10, 5);
    large.writeString(7, 4, "XYZ");

    const changes = diffBuffers(small, large);

    // Should include changes for cells outside small buffer
    const outsideChanges = changes.filter((c) => c.x >= 5 || c.y >= 3);
    expect(outsideChanges.length).toBeGreaterThan(0);
  });
});

describe("groupChangesByRow", () => {
  it("groups changes by y coordinate", () => {
    const a = new CellBuffer(10, 5);
    const b = new CellBuffer(10, 5);
    b.writeString(0, 0, "A");
    b.writeString(0, 2, "B");
    b.writeString(5, 2, "C");

    const changes = diffBuffers(a, b);
    const grouped = groupChangesByRow(changes);

    expect(grouped.size).toBe(2); // Rows 0 and 2
    expect(grouped.get(0)?.length).toBe(1);
    expect(grouped.get(2)?.length).toBe(2);
  });

  it("sorts changes within row by x coordinate", () => {
    const a = new CellBuffer(10, 5);
    const b = new CellBuffer(10, 5);
    b.set(5, 0, createCell("B"));
    b.set(2, 0, createCell("A"));
    b.set(8, 0, createCell("C"));

    const changes = diffBuffers(a, b);
    const grouped = groupChangesByRow(changes);
    const row = grouped.get(0)!;

    expect(row[0]!.x).toBe(2);
    expect(row[1]!.x).toBe(5);
    expect(row[2]!.x).toBe(8);
  });
});

describe("findRuns", () => {
  it("combines consecutive changes into runs", () => {
    const a = new CellBuffer(10, 5);
    const b = new CellBuffer(10, 5);
    b.writeString(2, 0, "HELLO");

    const changes = diffBuffers(a, b);
    const runs = findRuns(changes);

    expect(runs.length).toBe(1);
    expect(runs[0]!.x).toBe(2);
    expect(runs[0]!.y).toBe(0);
    expect(runs[0]!.cells.length).toBe(5);
    expect(runs[0]!.cells.map((c) => c.char).join("")).toBe("HELLO");
  });

  it("creates separate runs for non-consecutive changes", () => {
    const a = new CellBuffer(10, 5);
    const b = new CellBuffer(10, 5);
    b.set(0, 0, createCell("A"));
    b.set(5, 0, createCell("B"));

    const changes = diffBuffers(a, b);
    const runs = findRuns(changes);

    expect(runs.length).toBe(2);
    expect(runs[0]!.x).toBe(0);
    expect(runs[1]!.x).toBe(5);
  });

  it("handles multiple rows", () => {
    const a = new CellBuffer(10, 5);
    const b = new CellBuffer(10, 5);
    b.writeString(0, 0, "Row0");
    b.writeString(0, 2, "Row2");

    const changes = diffBuffers(a, b);
    const runs = findRuns(changes);

    expect(runs.length).toBe(2);
    expect(runs.find((r) => r.y === 0)).toBeDefined();
    expect(runs.find((r) => r.y === 2)).toBeDefined();
  });

  it("returns empty array for no changes", () => {
    const runs = findRuns([]);
    expect(runs).toEqual([]);
  });
});
