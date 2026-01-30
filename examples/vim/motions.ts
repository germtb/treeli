/**
 * Vim motion logic.
 * Motions move the cursor without modifying text.
 */

import type { CursorPosition } from "./vim.ts";

/**
 * Motion type identifiers.
 */
export type MotionType =
  | "h" | "j" | "k" | "l"  // character/line movement
  | "w" | "b" | "e"        // word movement
  | "0" | "$"              // line start/end
  | "^"                    // first non-whitespace
  | "gg" | "G"             // file start/end
  ;

/**
 * Motion with count.
 */
export interface Motion {
  type: MotionType;
  count: number;
}

/**
 * Parse a key into a motion.
 * Returns null if not a valid motion key.
 */
export function parseMotion(key: string): Motion | null {
  switch (key) {
    case "h":
    case "j":
    case "k":
    case "l":
    case "w":
    case "b":
    case "e":
    case "0":
    case "$":
    case "^":
    case "G":
      return { type: key, count: 1 };
    case "g":
      // 'g' alone is not a complete motion, but we can handle 'gg' in two-key parsing
      // For now, single 'g' is not a motion
      return null;
    default:
      return null;
  }
}

/**
 * Parse two consecutive keys for compound motions (like gg).
 */
export function parseDoubleMotion(key1: string, key2: string): Motion | null {
  if (key1 === "g" && key2 === "g") {
    return { type: "gg", count: 1 };
  }
  return null;
}

/**
 * Check if a character is a word character (alphanumeric or underscore).
 */
function isWordChar(char: string): boolean {
  return /\w/.test(char);
}

/**
 * Check if a character is whitespace.
 */
function isWhitespace(char: string): boolean {
  return char === " " || char === "\t";
}

/**
 * Execute a motion and return the new cursor position.
 */
export function executeMotion(
  lines: string[],
  cursor: CursorPosition,
  motion: Motion
): CursorPosition {
  const { type, count } = motion;
  let { line, col } = cursor;
  const maxLine = lines.length - 1;

  for (let i = 0; i < count; i++) {
    switch (type) {
      case "h":
        // Move left
        col = Math.max(0, col - 1);
        break;

      case "l":
        // Move right (can't go past last char in normal mode)
        const lineLen = lines[line]?.length ?? 0;
        col = Math.min(col + 1, Math.max(0, lineLen - 1));
        break;

      case "j":
        // Move down
        line = Math.min(line + 1, maxLine);
        // Clamp column to line length
        const newLineLen = lines[line]?.length ?? 0;
        col = Math.min(col, Math.max(0, newLineLen - 1));
        break;

      case "k":
        // Move up
        line = Math.max(line - 1, 0);
        // Clamp column to line length
        const prevLineLen = lines[line]?.length ?? 0;
        col = Math.min(col, Math.max(0, prevLineLen - 1));
        break;

      case "0":
        // Move to start of line
        col = 0;
        break;

      case "$":
        // Move to end of line
        const endLineLen = lines[line]?.length ?? 0;
        col = Math.max(0, endLineLen - 1);
        break;

      case "^":
        // Move to first non-whitespace character
        const currentLine = lines[line] ?? "";
        col = 0;
        while (col < currentLine.length && isWhitespace(currentLine[col]!)) {
          col++;
        }
        if (col >= currentLine.length) {
          col = Math.max(0, currentLine.length - 1);
        }
        break;

      case "w":
        // Move to start of next word
        {
          const currentLine = lines[line] ?? "";

          // If at end of line, move to next line
          if (col >= currentLine.length - 1 && line < maxLine) {
            line++;
            col = 0;
            const nextLine = lines[line] ?? "";
            // Skip leading whitespace
            while (col < nextLine.length && isWhitespace(nextLine[col]!)) {
              col++;
            }
            break;
          }

          // Skip current word if we're in one
          if (col < currentLine.length && isWordChar(currentLine[col]!)) {
            while (col < currentLine.length && isWordChar(currentLine[col]!)) {
              col++;
            }
          } else if (col < currentLine.length && !isWhitespace(currentLine[col]!)) {
            // Skip non-word, non-whitespace characters (punctuation)
            while (col < currentLine.length && !isWordChar(currentLine[col]!) && !isWhitespace(currentLine[col]!)) {
              col++;
            }
          }

          // Skip whitespace
          while (col < currentLine.length && isWhitespace(currentLine[col]!)) {
            col++;
          }

          // If we reached end of line, go to start of next line
          if (col >= currentLine.length && line < maxLine) {
            line++;
            col = 0;
            const nextLine = lines[line] ?? "";
            while (col < nextLine.length && isWhitespace(nextLine[col]!)) {
              col++;
            }
          }

          // Clamp to last char
          const finalLineLen = lines[line]?.length ?? 0;
          if (col >= finalLineLen) {
            col = Math.max(0, finalLineLen - 1);
          }
        }
        break;

      case "b":
        // Move to start of previous word
        {
          const currentLine = lines[line] ?? "";

          // If at start of line, move to end of previous line
          if (col === 0 && line > 0) {
            line--;
            const prevLine = lines[line] ?? "";
            col = Math.max(0, prevLine.length - 1);
            break;
          }

          // Move back one character first
          if (col > 0) col--;

          // Skip whitespace backward
          while (col > 0 && isWhitespace(currentLine[col]!)) {
            col--;
          }

          // Skip word or punctuation backward
          if (col >= 0 && isWordChar(currentLine[col]!)) {
            while (col > 0 && isWordChar(currentLine[col - 1]!)) {
              col--;
            }
          } else if (col >= 0 && !isWhitespace(currentLine[col]!)) {
            while (col > 0 && !isWordChar(currentLine[col - 1]!) && !isWhitespace(currentLine[col - 1]!)) {
              col--;
            }
          }
        }
        break;

      case "e":
        // Move to end of current/next word
        {
          const currentLine = lines[line] ?? "";

          // Move forward one character to start
          if (col < currentLine.length - 1) {
            col++;
          } else if (line < maxLine) {
            // Move to next line
            line++;
            col = 0;
            const nextLine = lines[line] ?? "";
            // Skip leading whitespace
            while (col < nextLine.length && isWhitespace(nextLine[col]!)) {
              col++;
            }
          }

          const lineForE = lines[line] ?? "";

          // Skip whitespace
          while (col < lineForE.length && isWhitespace(lineForE[col]!)) {
            col++;
          }

          // Find end of word
          if (col < lineForE.length && isWordChar(lineForE[col]!)) {
            while (col < lineForE.length - 1 && isWordChar(lineForE[col + 1]!)) {
              col++;
            }
          } else if (col < lineForE.length && !isWhitespace(lineForE[col]!)) {
            while (col < lineForE.length - 1 && !isWordChar(lineForE[col + 1]!) && !isWhitespace(lineForE[col + 1]!)) {
              col++;
            }
          }
        }
        break;

      case "gg":
        // Move to first line
        line = 0;
        col = 0;
        break;

      case "G":
        // Move to last line
        line = maxLine;
        col = 0;
        break;
    }
  }

  return { line, col };
}
