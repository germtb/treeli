/**
 * Reactive TUI renderer.
 * Components run once, and only the parts that depend on changed signals re-render.
 */

import { Renderer, type RendererOptions } from "./renderer.ts";
import { createRoot, createEffect, batch, type Owner } from "./reactive.ts";
import type { VNode } from "./vnode.ts";

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
}

export function run(App: () => VNode, options: RunOptions = {}): void {
  const width = options.width ?? process.stdout.columns ?? 80;
  const height = options.height ?? process.stdout.rows ?? 24;

  const app = render(App, {
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
