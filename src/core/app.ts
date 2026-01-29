/**
 * Reactive TUI renderer.
 * Components run once, and only the parts that depend on changed signals re-render.
 */

import { Renderer, type RendererOptions } from "./renderer.ts";
import { createRoot, createEffect, createSignal, batch, type Owner } from "./reactive.ts";
import type { VNode } from "./vnode.ts";
import { ConsoleCapture } from "./console-capture.ts";
import { createVNode } from "./vnode.ts";

export interface ReactiveAppOptions extends RendererOptions {
  /** Called before each render */
  onRender?: () => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

export interface ReactiveApp {
  /** Force a full re-render */
  rerender(): void;
  /** Dispose the app and cleanup all reactive subscriptions */
  dispose(): void;
  /** Get the underlying renderer */
  renderer: Renderer;
  /** Resize the terminal */
  resize(width: number, height: number): void;
}

/**
 * Create a reactive TUI application.
 *
 * @example
 * ```tsx
 * import { createSignal, render } from 'treeli';
 *
 * function App() {
 *   const [count, setCount] = createSignal(0);
 *
 *   return (
 *     <box>
 *       <text>Count: {count()}</text>
 *     </box>
 *   );
 * }
 *
 * const app = render(App, { width: 80, height: 24 });
 * ```
 */
export function render(
  App: () => VNode,
  options: ReactiveAppOptions
): ReactiveApp {
  const renderer = new Renderer(options);
  let disposeRoot: (() => void) | null = null;
  let currentVNode: VNode | null = null;

  const doRender = () => {
    if (currentVNode) {
      options.onRender?.();
      renderer.render(currentVNode);
    }
  };

  // Create reactive root
  disposeRoot = createRoot((dispose) => {
    // Create effect that re-runs when signals used in App change
    createEffect(() => {
      try {
        currentVNode = App();
        doRender();
      } catch (error) {
        if (options.onError) {
          options.onError(error as Error);
        } else {
          console.error("Render error:", error);
        }
      }
    });

    return dispose;
  }) as () => void;

  return {
    rerender() {
      doRender();
    },

    dispose() {
      if (disposeRoot) {
        disposeRoot();
        disposeRoot = null;
      }
    },

    renderer,

    resize(width: number, height: number) {
      renderer.resize(width, height);
      doRender();
    },
  };
}

/**
 * Run a TUI app with terminal handling.
 *
 * @example
 * ```tsx
 * import { createSignal, run } from 'treeli';
 *
 * function App() {
 *   const [count, setCount] = createSignal(0);
 *
 *   // Expose setter for keyboard handling
 *   (globalThis as any).setCount = setCount;
 *
 *   return <text>Count: {count()}</text>;
 * }
 *
 * run(App, {
 *   onKeypress(key) {
 *     if (key === '+') (globalThis as any).setCount((c: number) => c + 1);
 *     if (key === 'q') return true; // Exit
 *   }
 * });
 * ```
 */
export interface RunOptions extends Omit<ReactiveAppOptions, "width" | "height"> {
  /** Terminal width (defaults to stdout.columns or 80) */
  width?: number;
  /** Terminal height (defaults to stdout.rows or 24) */
  height?: number;
  /** Handle keypress. Return true to exit. */
  onKeypress?: (key: string, app: ReactiveApp) => boolean | void;
  /** Called when app starts */
  onMount?: (app: ReactiveApp) => void;
  /** Called when app exits */
  onUnmount?: () => void;
  /** Capture console output (default: true). Press Ctrl+L to toggle log viewer. */
  captureConsole?: boolean;
  /** Maximum number of console messages to keep in memory (default: 1000) */
  maxConsoleMessages?: number;
}

export function run(App: () => VNode, options: RunOptions = {}): void {
  const width = options.width ?? process.stdout.columns ?? 80;
  const height = options.height ?? process.stdout.rows ?? 24;
  const captureConsole = options.captureConsole ?? true;
  const maxConsoleMessages = options.maxConsoleMessages ?? 1000;

  // Setup console capture if enabled
  let consoleCapture: ConsoleCapture | null = null;
  const [showLogs, setShowLogs] = createSignal(false);

  if (captureConsole) {
    consoleCapture = new ConsoleCapture(maxConsoleMessages);
    consoleCapture.start();
  }

  // Wrap App to overlay logs when enabled
  const WrappedApp = () => {
    const appContent = App();
    const logsVisible = showLogs();

    if (!logsVisible || !consoleCapture) {
      return appContent;
    }

    // Render logs as bottom panel - app content stays visible above
    // getMessages() is reactive - triggers re-render when messages change
    const messages = consoleCapture.getMessages();
    const panelHeight = Math.max(6, Math.floor(height / 3)); // 1/3 of screen, min 6 rows
    const panelY = height - panelHeight;
    const maxLines = panelHeight - 4; // Account for border, padding, header
    const visibleMessages = messages.slice(-maxLines);

    return createVNode("box", { width, height }, [
      appContent,
      // Bottom panel for logs
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

  const app = render(WrappedApp, {
    ...options,
    width,
    height,
  });

  // Setup terminal
  const setupTerminal = () => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdout.write("\x1b[?25l"); // Hide cursor
  };

  const cleanupTerminal = () => {
    process.stdout.write("\x1b[2J\x1b[H"); // Clear screen
    process.stdout.write("\x1b[?25h"); // Show cursor
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  };

  const exit = () => {
    if (consoleCapture) {
      consoleCapture.stop();
    }
    app.dispose();
    cleanupTerminal();
    options.onUnmount?.();
    process.exit(0);
  };

  setupTerminal();

  // Handle keyboard
  process.stdin.on("data", (data) => {
    const key = data.toString();

    // Ctrl+C always exits
    if (key === "\x03") {
      exit();
      return;
    }

    // Ctrl+L toggles log viewer (if console capture is enabled)
    if (key === "\x0c" && consoleCapture) {
      setShowLogs(!showLogs());
      return;
    }

    // Ctrl+K clears console logs (if console capture is enabled and logs are visible)
    if (key === "\x0b" && consoleCapture && showLogs()) {
      consoleCapture.clear();
      return;
    }

    if (options.onKeypress) {
      const shouldExit = options.onKeypress(key, app);
      if (shouldExit) {
        exit();
        return;
      }
    }
  });

  // Handle resize
  process.stdout.on("resize", () => {
    app.resize(
      process.stdout.columns ?? 80,
      process.stdout.rows ?? 24
    );
  });

  // Handle exit signals
  process.on("SIGINT", exit);
  process.on("SIGTERM", exit);

  options.onMount?.(app);
}
