// Core exports
export { CellBuffer } from "./core/buffer.ts";
export { LogicalBuffer, type LogicalRow } from "./core/logical-buffer.ts";
export { type Cell, type Style, type Color, createCell, EMPTY_CELL } from "./core/cell.ts";
export {
  type VNode,
  type Component,
  type Props,
  createVNode,
  createTextNode,
} from "./core/vnode.ts";
export {
  type LayoutProps,
  type InputElementProps,
  type TextElementProps,
  type SelectElementProps,
  type OptionElementProps,
  type Direction,
  type Justify,
  type Align,
  type Position,
  type BorderStyle,
  type Overflow,
  type Spacing,
  BORDER_CHARS,
} from "./core/props.ts";
export { Renderer, type RendererOptions } from "./core/renderer.ts";

// Reactive (Solid.js-style)
export {
  createSignal,
  createEffect,
  createMemo,
  createRoot,
  onCleanup,
  batch,
  untrack,
  type Signal,
  type Accessor,
  type Setter,
} from "./core/reactive.ts";

// App
export {
  render,
  run,
  type ReactiveApp,
  type ReactiveAppOptions,
  type RunOptions,
} from "./core/app.ts";

// Console capture
export { ConsoleCapture, type ConsoleMessage } from "./core/console-capture.ts";

// Headless runner
export { createHeadlessRunner, type HeadlessRunner, type HeadlessRunnerOptions } from "./core/headless-runner.ts";

// Legacy alias for backwards compatibility
export { createHeadlessRunner as createTestRunner } from "./core/headless-runner.ts";
export type { HeadlessRunner as TestRunner, HeadlessRunnerOptions as TestRunnerOptions } from "./core/headless-runner.ts";

// Input primitive
export {
  createInput,
  defaultInputHandler,
  inputHandlers,
  composeHandlers,
  type InputOptions,
  type InputState,
  type Input,
  type KeypressHandler,
} from "./core/input.ts";

// Button primitive
export {
  createButton,
  type ButtonOptions,
  type Button,
} from "./core/button.ts";

// Select primitive
export {
  createSelect,
  type SelectOptions,
  type Select,
} from "./core/select.ts";

// Focus management
export {
  focus,
  KEYS,
  createFocusable,
  createKeySequence,
  type Focusable,
  type FocusableOptions,
  type KeySequenceOptions,
} from "./core/focus.ts";

// Clipboard
export { copyToClipboard, copyToPrimary } from "./core/clipboard.ts";

// JSX runtime (re-export for convenience)
export { jsx, jsxs, Fragment } from "./jsx/jsx-runtime.ts";
