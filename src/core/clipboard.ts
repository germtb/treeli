/**
 * Clipboard utilities using OSC 52 escape sequence.
 * Works with most modern terminals (iTerm2, Alacritty, kitty, WezTerm, etc.)
 */

/**
 * Copy text to the system clipboard using OSC 52.
 * The terminal intercepts this escape sequence and copies the text.
 */
export function copyToClipboard(text: string): void {
  const base64 = Buffer.from(text).toString("base64");
  process.stdout.write(`\x1b]52;c;${base64}\x07`);
}

/**
 * Copy text to the primary selection (X11) using OSC 52.
 * Only works on X11 systems.
 */
export function copyToPrimary(text: string): void {
  const base64 = Buffer.from(text).toString("base64");
  process.stdout.write(`\x1b]52;p;${base64}\x07`);
}
