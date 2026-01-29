/**
 * Console capture utility for TUI applications.
 * Captures console output to memory and provides a way to view it in the TUI.
 */

import { createSignal, type Accessor } from "./reactive.ts";

export interface ConsoleMessage {
  timestamp: Date;
  level: "log" | "error" | "warn" | "info" | "debug";
  args: unknown[];
}

export class ConsoleCapture {
  private _messages: [Accessor<ConsoleMessage[]>, (v: ConsoleMessage[] | ((prev: ConsoleMessage[]) => ConsoleMessage[])) => void];
  private maxMessages: number;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    debug: typeof console.debug;
  };

  constructor(maxMessages = 1000) {
    this.maxMessages = maxMessages;
    this._messages = createSignal<ConsoleMessage[]>([]);
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
    };
  }

  /**
   * Start capturing console output
   */
  start(): void {
    const capture = (level: ConsoleMessage["level"]) => {
      return (...args: unknown[]) => {
        const msg: ConsoleMessage = {
          timestamp: new Date(),
          level,
          args,
        };

        // Update signal with new array (triggers reactivity)
        this._messages[1]((prev) => {
          const next = [...prev, msg];
          // Trim if over limit
          if (next.length > this.maxMessages) {
            return next.slice(-this.maxMessages);
          }
          return next;
        });

        // Still write to original console (stderr) for debugging outside TUI
        // But only if we're not in a TTY (to avoid corrupting TUI)
        if (!process.stdout.isTTY) {
          this.originalConsole[level](...args);
        }
      };
    };

    console.log = capture("log");
    console.error = capture("error");
    console.warn = capture("warn");
    console.info = capture("info");
    console.debug = capture("debug");
  }

  /**
   * Stop capturing and restore original console
   */
  stop(): void {
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;
  }

  /**
   * Get all captured messages (reactive - triggers re-render when messages change)
   */
  getMessages(): readonly ConsoleMessage[] {
    return this._messages[0]();
  }

  /**
   * Clear all captured messages
   */
  clear(): void {
    this._messages[1]([]);
  }

  /**
   * Format a message for display
   */
  formatMessage(msg: ConsoleMessage): string {
    const time = msg.timestamp.toISOString().split("T")[1]?.slice(0, 12) || "";
    const level = msg.level.toUpperCase().padEnd(5);
    const content = msg.args
      .map((arg) => {
        if (typeof arg === "string") return arg;
        if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(" ");

    return `[${time}] ${level} ${content}`;
  }

  /**
   * Get the last N messages (reactive)
   */
  getLastMessages(count: number): readonly ConsoleMessage[] {
    return this._messages[0]().slice(-count);
  }
}
