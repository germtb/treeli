/**
 * Vim operator logic.
 * Operators act on text (delete, yank, change, etc.).
 */

/**
 * Operator type identifiers.
 */
export type OperatorType =
  | "d"   // delete (waits for motion)
  | "y"   // yank (waits for motion)
  | "c"   // change (waits for motion)
  | "x"   // delete char (immediate)
  | "dd"  // delete line (immediate)
  | "yy"  // yank line (immediate)
  | "p"   // paste after
  | "P"   // paste before
  ;

/**
 * Operator definition.
 */
export interface Operator {
  type: OperatorType;
  /** Whether this operator needs a motion to complete */
  needsMotion: boolean;
}

/**
 * Parse a key into an operator.
 * Returns null if not a valid operator key.
 */
export function parseOperator(key: string): Operator | null {
  switch (key) {
    case "d":
      return { type: "d", needsMotion: true };
    case "y":
      return { type: "y", needsMotion: true };
    case "c":
      return { type: "c", needsMotion: true };
    case "x":
      return { type: "x", needsMotion: false };
    case "p":
      return { type: "p", needsMotion: false };
    case "P":
      return { type: "P", needsMotion: false };
    default:
      return null;
  }
}

/**
 * Parse a compound operator (dd, yy, cc).
 */
export function parseDoubleOperator(key1: string, key2: string): Operator | null {
  if (key1 === "d" && key2 === "d") {
    return { type: "dd", needsMotion: false };
  }
  if (key1 === "y" && key2 === "y") {
    return { type: "yy", needsMotion: false };
  }
  if (key1 === "c" && key2 === "c") {
    return { type: "c", needsMotion: false }; // cc is change line
  }
  return null;
}

/**
 * Result of executing an operator.
 */
export interface OperatorResult {
  /** The modified lines */
  lines: string[];
  /** New cursor position */
  cursorLine: number;
  cursorCol: number;
  /** Text that was deleted/yanked (for register) */
  yankedText: string;
  /** Whether to enter insert mode after */
  enterInsert: boolean;
}

/**
 * Execute an operator on a range of text.
 *
 * Note: Most operator execution is done inline in vim.ts for simplicity.
 * This module primarily provides parsing and type definitions.
 */
export function executeOperator(
  lines: string[],
  startLine: number,
  startCol: number,
  endLine: number,
  endCol: number,
  operator: Operator
): OperatorResult {
  const result: OperatorResult = {
    lines: [...lines],
    cursorLine: startLine,
    cursorCol: startCol,
    yankedText: "",
    enterInsert: false,
  };

  // Ensure start is before end
  if (startLine > endLine || (startLine === endLine && startCol > endCol)) {
    [startLine, startCol, endLine, endCol] = [endLine, endCol, startLine, startCol];
  }

  switch (operator.type) {
    case "x":
      // Delete character at cursor
      {
        const line = result.lines[startLine] ?? "";
        if (line.length > 0 && startCol < line.length) {
          result.yankedText = line[startCol]!;
          result.lines[startLine] = line.slice(0, startCol) + line.slice(startCol + 1);
          // Clamp cursor
          const newLen = result.lines[startLine]!.length;
          if (startCol >= newLen && newLen > 0) {
            result.cursorCol = newLen - 1;
          }
        }
      }
      break;

    case "d":
    case "dd":
      // Delete range
      if (operator.type === "dd" || startLine !== endLine) {
        // Line-wise delete
        const deletedLines = result.lines.splice(startLine, endLine - startLine + 1);
        result.yankedText = deletedLines.join("\n");
        if (result.lines.length === 0) {
          result.lines.push("");
        }
        result.cursorLine = Math.min(startLine, result.lines.length - 1);
        result.cursorCol = 0;
      } else {
        // Character-wise delete within a line
        const line = result.lines[startLine] ?? "";
        result.yankedText = line.slice(startCol, endCol + 1);
        result.lines[startLine] = line.slice(0, startCol) + line.slice(endCol + 1);
        result.cursorCol = startCol;
        // Clamp cursor
        const newLen = result.lines[startLine]!.length;
        if (result.cursorCol >= newLen && newLen > 0) {
          result.cursorCol = newLen - 1;
        }
      }
      break;

    case "y":
    case "yy":
      // Yank range (no modification)
      if (operator.type === "yy" || startLine !== endLine) {
        // Line-wise yank
        const yankedLines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
          yankedLines.push(result.lines[i]!);
        }
        result.yankedText = yankedLines.join("\n");
      } else {
        // Character-wise yank
        const line = result.lines[startLine] ?? "";
        result.yankedText = line.slice(startCol, endCol + 1);
      }
      break;

    case "c":
      // Change is like delete but enters insert mode
      {
        const line = result.lines[startLine] ?? "";
        if (startLine === endLine) {
          result.yankedText = line.slice(startCol, endCol + 1);
          result.lines[startLine] = line.slice(0, startCol) + line.slice(endCol + 1);
        } else {
          // Multi-line change - delete all and leave cursor
          const deletedLines = result.lines.splice(startLine, endLine - startLine + 1);
          result.yankedText = deletedLines.join("\n");
          result.lines.splice(startLine, 0, "");
        }
        result.cursorCol = startCol;
        result.enterInsert = true;
      }
      break;

    case "p":
    case "P":
      // Paste is handled directly in vim.ts since it needs the register
      break;
  }

  return result;
}
