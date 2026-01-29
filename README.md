# treeli

A declarative TUI (Terminal User Interface) framework using JSX and efficient cell-based diffing.

## Features

- **JSX Syntax** - Write terminal UIs with familiar JSX syntax
- **Reactive Primitives** - Solid.js-style reactivity with `createSignal`, `createEffect`, `createMemo`
- **Efficient Rendering** - Two-tier optimization with Merkle tree hashing and cell-level diffing
- **Flexbox Layout** - Intuitive flexbox-inspired layout system
- **Focus Management** - Built-in keyboard navigation and focus handling
- **Zero Dependencies** - Lightweight with no runtime dependencies

## Installation

```bash
npm install treeli
# or
bun add treeli
# or
yarn add treeli
```

## Quick Start

```tsx
import { run, createSignal } from "treeli";

function App() {
  const [count, setCount] = createSignal(0);

  return (
    <box direction="column" padding={1}>
      <text>Count: {count()}</text>
      <text style={{ color: "gray" }}>Press +/- to change, q to quit</text>
    </box>
  );
}

run(App, {
  onKeypress: (key, { exit }) => {
    if (key === "q") exit();
  },
});
```

## JSX Configuration

Configure your `tsconfig.json` to use treeli's JSX runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "treeli"
  }
}
```

## API Reference

### Components

- **`<box>`** - Container with flexbox layout
  - `direction` - `"row"` | `"column"`
  - `justify` - `"start"` | `"end"` | `"center"` | `"space-between"` | `"space-around"`
  - `align` - `"start"` | `"end"` | `"center"` | `"stretch"`
  - `padding`, `margin` - Spacing (number or `{ top, right, bottom, left }`)
  - `width`, `height`, `minWidth`, `minHeight` - Sizing
  - `border` - `true` | `"single"` | `"double"` | `"rounded"` | `"bold"`
  - `style` - `{ color, background, bold, italic, underline, dim, inverse }`

- **`<text>`** - Text content
  - `style` - Same as box

- **Fragments** - `<>...</>` for vertical stacking without a container

### Reactive Primitives

```tsx
import { createSignal, createEffect, createMemo, batch } from "treeli";

// Signals - reactive state
const [value, setValue] = createSignal(0);
setValue(1);
setValue((prev) => prev + 1);

// Effects - side effects that track dependencies
createEffect(() => {
  console.log("Value changed:", value());
});

// Memos - derived/computed values
const doubled = createMemo(() => value() * 2);

// Batch - group multiple updates
batch(() => {
  setValue(1);
  setOther(2);
});
```

### App Lifecycle

```tsx
import { run, render, createRoot } from "treeli";

// Simple app with run()
run(App, {
  onKeypress: (key, { exit }) => { /* handle keys */ },
  fullscreen: true,
});

// Manual control with render()
const app = render(App, { fullscreen: true });
app.refresh();
app.cleanup();
```

### Input & Focus

```tsx
import { createInput, createButton, focus, KEYS } from "treeli";

// Text input
const input = createInput({
  placeholder: "Enter text...",
  onSubmit: (value) => console.log(value),
});

// Button
const button = createButton({
  onPress: () => console.log("Pressed!"),
});

// Focus management
focus.register(input);
focus.register(button);
focus.next(); // Move to next focusable
focus.prev(); // Move to previous
```

## Examples

Check out the [examples](./examples) directory:

```bash
# Basic demo
bun examples/demo.ts

# JSX demo
bun examples/jsx-demo.tsx
```

## Architecture

```
JSX Components → VNode Tree (Merkle hashes) → Layout → Cell Buffer → Diff → ANSI Output
```

1. **VNode Tree** - JSX compiles to virtual nodes with Merkle hashes for change detection
2. **Layout Engine** - Flexbox-style positioning calculates absolute coordinates
3. **Cell Buffer** - Terminal as 2D matrix of characters + styles
4. **Diffing** - Only changed cells are written to terminal

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](./LICENSE) - see LICENSE file for details.
