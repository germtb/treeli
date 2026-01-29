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
- `<>...</>` - Fragment (vertical stacking)

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
