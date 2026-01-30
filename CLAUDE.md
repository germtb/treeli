# treeli TUI Framework

A declarative TUI (Terminal User Interface) framework using JSX and efficient cell-based diffing.

## Architecture

```
JSX Components → VNode Tree (with Merkle hashes) → Layout → Cell Buffer → Diff → ANSI Output
```

### Key Design Decisions

1. **Two-tier optimization**:
   - **Tree level**: Merkle hashes skip unchanged subtree rendering
   - **Buffer level**: Cell-by-cell diffing skips unchanged terminal output

2. **Cell Buffer**: The terminal is treated as a 2D matrix of "pixels" (characters + styles)

3. **Custom JSX**: No React dependency, minimal overhead

## Project Structure

```
src/
  core/
    cell.ts      # Cell type (char + style)
    buffer.ts    # 2D CellBuffer matrix
    diff.ts      # Buffer diffing
    vnode.ts     # VNode + Merkle hashing
    layout.ts    # Tree → Buffer positioning
    ansi.ts      # ANSI escape code generation
    renderer.ts  # Main render orchestrator
    reactive.ts  # Signals, effects, memos
    input.ts     # Text input primitive
    button.ts    # Button primitive
    select.ts    # Select/dropdown primitive
    focus.ts     # Focus management
    props.ts     # Layout prop types
  jsx/
    jsx-runtime.ts     # JSX factory
    jsx-dev-runtime.ts # Dev mode factory
  index.ts       # Public exports
tests/           # Unit tests
examples/        # Demo applications
```

## Commands

- `bun test` - Run all tests
- `bun run build` - Build for distribution
- `bun run typecheck` - Type check without emitting
- `bun examples/demo.ts` - Run non-JSX demo
- `bun examples/jsx-demo.tsx` - Run JSX demo

## JSX Elements

- `<text>` - Text content with optional style
- `<box>` - Container with flexbox-like layout
- `<input>` - Text input field (requires `input` primitive)
- `<select>` - Selection list (requires `select` primitive)
- `<option>` - Option within a select
- `<>...</>` - Fragment (vertical stacking)

## Focusable Primitives

Create primitives with `createInput()`, `createButton()`, `createSelect()`, or `createFocusable()`:

```tsx
const input = createInput({ placeholder: "Type here" });
const btn = createButton({ onPress: () => console.log("Pressed!") });
const sel = createSelect({ initialValue: "a" });

// Focus management - the focus manager routes ALL stdin to focusables
input.focus();  // Focus this element
focus.next();   // Tab to next focusable
focus.prev();   // Shift+Tab to previous

// Use in JSX
<input input={input} />
<select select={sel}>
  <option value="a">Option A</option>
  <option value="b">Option B</option>
</select>
```

### Key Handling Architecture

All keyboard input flows through the focus system:

```
stdin → focus.handleKey() → focused element → unhandled key handler
```

- **No `onKeypress` in `run()`** - all keys go through focus manager
- **Tab/Shift+Tab** handled automatically for focus navigation
- **Focusables consume keys** by returning `true` from `handleKey`
- **Unhandled keys** can be caught with `focus.setUnhandledKeyHandler()`

### Custom Focusables with `createFocusable()`

For apps that need global key handling without a visible input:

```tsx
const { focusable: appInput } = createFocusable({
  onKey: (key) => {
    if (key === "+") { increment(); return true; }
    if (key === "-") { decrement(); return true; }
    return false; // not consumed
  },
});
appInput.focus();

run(App); // No onKeypress needed - focus manager handles everything
```

### Select Props

Navigation directly changes the selection (no separate "focused" vs "selected" state).

```tsx
<select
  select={sel}                           // Required: the select primitive
  pointer={<text color="cyan">❯ </text>} // Custom pointer element
  pointerWidth={2}                       // Pointer column width
  optionStyle={{ color: "white" }}       // Base style for all options
  selectedStyle={{ bold: true }}         // Merged when option is selected
>
  <option value="a">Option A</option>
  <option value="b" style={{ color: "red" }}>Red Option</option>
</select>
```

Select API:
- `sel.value()` - Current selected value
- `sel.selectedIndex()` - Index of current selection
- `sel.next()` / `sel.prev()` - Navigate (and select)
- `sel.setValue(v)` / `sel.setIndex(i)` - Set selection
- `sel.isSelected(v)` / `sel.isSelectedIndex(i)` - Check selection

### FZF-like Pattern

For filtered selects where input and navigation work together:

```tsx
const input = createInput({
  onKeypress: (key, state) => {
    // Arrow keys control the select navigation
    if (key === KEYS.UP) { sel.prev(); return state; }
    if (key === KEYS.DOWN) { sel.next(); return state; }
    return defaultInputHandler(key, state);
  },
});

const sel = createSelect({
  focusable: false,  // Not in Tab order, controlled by input
});
```

## Layout Props

- `direction` - `"row"` | `"column"` (default: column)
- `justify` - `"start"` | `"center"` | `"end"` | `"space-between"` | `"space-around"`
- `align` - `"start"` | `"center"` | `"end"` | `"stretch"`
- `gap` - Number of cells between children
- `padding`, `margin` - Spacing (number or `{ top, right, bottom, left }`)
- `border` - `true` | `"single"` | `"double"` | `"rounded"` | `"bold"`

## Style Props

- `color` - Foreground color
- `background` - Background color
- `bold`, `dim`, `italic`, `underline`, `inverse`, `strikethrough` - Text decorations

Colors: `"default"`, `"black"`, `"red"`, `"green"`, `"yellow"`, `"blue"`, `"magenta"`, `"cyan"`, `"white"`, or `{ rgb: [r, g, b] }`

## Development

This project uses Bun. Use `bun` instead of `node`, `npm`, etc.

```bash
bun install        # Install dependencies
bun test           # Run tests
bun run typecheck  # Type check
bun run build      # Build for distribution
```
