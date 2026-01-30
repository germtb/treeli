/**
 * Headless runner for TUI applications.
 * Runs apps without terminal output, with buffer capture and keypress injection.
 * Useful for testing, automation, and programmatic control.
 */

import { Renderer } from "./renderer.ts";
import { CellBuffer } from "./buffer.ts";
import { createRoot, createEffect, createSignal, batch } from "./reactive.ts";
import { focus, KEYS } from "./focus.ts";
import { ConsoleCapture } from "./console-capture.ts";
import { createVNode } from "./vnode.ts";
import type { VNode } from "./vnode.ts";

export interface HeadlessRunnerOptions {
  /** Terminal width (default: 80) */
  width?: number;
  /** Terminal height (default: 24) */
  height?: number;
  /** Enable console capture (default: true) */
  captureConsole?: boolean;
}

export interface HeadlessRunner {
  /** Get the current screen as a string (all rows joined by newlines) */
  getScreen(): string;

  /** Get a specific row from the screen */
  getRow(y: number): string;

  /** Get the raw cell buffer for detailed assertions */
  getBuffer(): CellBuffer;

  /** Simulate a keypress */
  pressKey(key: string): void;

  /** Simulate typing a string (sends each character) */
  type(text: string): void;

  /** Check if the screen contains a string */
  hasText(text: string): boolean;

  /** Get the console capture instance (if enabled) */
  getConsoleCapture(): ConsoleCapture | null;

  /** Check if console log panel is visible */
  isLogPanelVisible(): boolean;

  /** Get the current focused element (for debugging) */
  getFocusedElement(): string;

  /** Dispose the headless runner and clean up */
  dispose(): void;
}

/**
 * Create a headless runner for a TUI application.
 *
 * @example
 * ```ts
 * import { createHeadlessRunner, KEYS } from 'treeli';
 *
 * function App() {
 *   return <text>Hello World</text>;
 * }
 *
 * const runner = createHeadlessRunner(App);
 * expect(runner.hasText("Hello World")).toBe(true);
 *
 * runner.pressKey(KEYS.CTRL_L);
 * expect(runner.isLogPanelVisible()).toBe(true);
 *
 * runner.dispose();
 * ```
 */
export function createHeadlessRunner(
  App: () => VNode,
  options: HeadlessRunnerOptions = {}
): HeadlessRunner {
  const width = options.width ?? 80;
  const height = options.height ?? 24;
  const captureConsole = options.captureConsole ?? true;

  // Note: We do NOT call focus.clear() here because the user's focusables
  // are already registered before createTestRunner is called.

  // Setup console capture
  let consoleCapture: ConsoleCapture | null = null;
  const [showLogs, setShowLogs] = createSignal(false);

  if (captureConsole) {
    consoleCapture = new ConsoleCapture();
    consoleCapture.start();
  }

  // Create renderer with silent output (doesn't write to stdout)
  const renderer = new Renderer({ width, height, output: () => {} });
  let disposeRoot: (() => void) | null = null;
  let currentVNode: VNode | null = null;

  // Wrap App to overlay logs when enabled (same as app.ts)
  const WrappedApp = () => {
    const appContent = App();
    const logsVisible = showLogs();

    if (!logsVisible || !consoleCapture) {
      return appContent;
    }

    const messages = consoleCapture.getMessages();
    const panelHeight = Math.max(6, Math.floor(height / 3));
    const panelY = height - panelHeight;
    const maxLines = panelHeight - 4;
    const visibleMessages = messages.slice(-maxLines);

    return createVNode("box", { width, height }, [
      appContent,
      createVNode(
        "box",
        {
          position: "absolute" as const,
          x: 0,
          y: panelY,
          width: width,
          height: panelHeight,
          border: "single" as const,
          overflow: "hidden" as const,
          style: { background: "black", color: "white" },
        },
        [
          createVNode("text", { style: { bold: true, color: "cyan" } }, [
            createVNode("__text__", { text: ` Console (${messages.length}) - Ctrl+L close, Ctrl+K clear` }, []),
          ]),
          ...visibleMessages.map((msg) =>
            createVNode("text", { style: { color: msg.level === "error" ? "red" : msg.level === "warn" ? "yellow" : "white" }, wrap: true }, [
              createVNode("__text__", { text: ` ${consoleCapture!.formatMessage(msg)}` }, []),
            ])
          ),
        ]
      ),
    ]);
  };

  // Setup unhandled key handler for console shortcuts
  let cleanupHandler: (() => void) | null = null;
  if (consoleCapture) {
    cleanupHandler = focus.setUnhandledKeyHandler((key) => {
      if (key === KEYS.CTRL_L) {
        setShowLogs(!showLogs());
        return true;
      }
      if (key === KEYS.CTRL_K && showLogs()) {
        consoleCapture!.clear();
        return true;
      }
      return false;
    });
  }

  // Create reactive root and render
  const doRender = () => {
    if (currentVNode) {
      renderer.render(currentVNode);
    }
  };

  disposeRoot = createRoot((dispose) => {
    createEffect(() => {
      currentVNode = WrappedApp();
      doRender();
    });
    return dispose;
  }) as () => void;

  // Helper to get screen as string
  const getScreen = (): string => {
    const buffer = renderer.getCurrentBuffer();
    const lines: string[] = [];
    for (let y = 0; y < height; y++) {
      let line = "";
      for (let x = 0; x < width; x++) {
        const cell = buffer.get(x, y);
        line += cell?.char ?? " ";
      }
      lines.push(line.trimEnd());
    }
    return lines.join("\n");
  };

  const getRow = (y: number): string => {
    const buffer = renderer.getCurrentBuffer();
    let line = "";
    for (let x = 0; x < width; x++) {
      const cell = buffer.get(x, y);
      line += cell?.char ?? " ";
    }
    return line.trimEnd();
  };

  const pressKey = (key: string): void => {
    // Don't handle Ctrl+C in tests
    if (key === KEYS.CTRL_C) {
      return;
    }
    focus.handleKey(key);
  };

  const type = (text: string): void => {
    for (const char of text) {
      pressKey(char);
    }
  };

  const hasText = (text: string): boolean => {
    return getScreen().includes(text);
  };

  const getFocusedElement = (): string => {
    const current = focus.current();
    if (!current) return "none";
    // Try to identify the element
    const all = focus.getAll();
    const index = all.indexOf(current);
    return `focusable[${index}]`;
  };

  return {
    getScreen,
    getRow,
    getBuffer: () => renderer.getCurrentBuffer(),
    pressKey,
    type,
    hasText,
    getConsoleCapture: () => consoleCapture,
    isLogPanelVisible: () => showLogs(),
    getFocusedElement,
    dispose: () => {
      cleanupHandler?.();
      if (consoleCapture) {
        consoleCapture.stop();
      }
      if (disposeRoot) {
        disposeRoot();
      }
      // Note: We don't call focus.clear() here because the focusables
      // may be module-level and shared across tests. Tests should manage
      // their own focus state if needed.
    },
  };
}
