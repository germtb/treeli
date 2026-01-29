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
  type Direction,
  type Justify,
  type Align,
  type Position,
  type BorderStyle,
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

// Input primitive
export {
  createInput,
  defaultInputHandler,
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

// Focus management
export { focus, KEYS, type Focusable } from "./core/focus.ts";

// Clipboard
export { copyToClipboard, copyToPrimary } from "./core/clipboard.ts";

// JSX runtime (re-export for convenience)
export { jsx, jsxs, Fragment } from "./jsx/jsx-runtime.ts";
